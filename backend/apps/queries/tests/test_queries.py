from unittest.mock import MagicMock
import pytest

from apps.connections.crypto import encrypt
from apps.connections.models import Connection
from apps.drivers.base import (
    ColumnMeta,
    DriverCancelledError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
    QueryResult,
)
from apps.drivers.pool import run_tracker
from apps.queries.models import QueryHistory, SavedQuery
from apps.queries.safety import analyze_sql_safety, is_mutation_statement

pytestmark = pytest.mark.django_db


@pytest.fixture
def test_connection(user):
    return Connection.objects.create(
        owner=user,
        name="query-db",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
        encrypted_password=encrypt("pass"),
        read_only=False,
    )


@pytest.fixture
def read_only_connection(user):
    return Connection.objects.create(
        owner=user,
        name="ro-db",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
        encrypted_password=encrypt("pass"),
        read_only=True,
    )


# --- 1. SQL Safety Tests ---


def test_safety_catches_unbounded_delete_and_update():
    assert len(analyze_sql_safety("DELETE FROM users")) == 1
    assert "DELETE statement without a WHERE clause" in analyze_sql_safety("DELETE FROM users")[0]

    assert len(analyze_sql_safety("DELETE FROM users WHERE id = 10")) == 0

    assert len(analyze_sql_safety("UPDATE users SET active = false")) == 1
    assert "UPDATE statement without a WHERE clause" in analyze_sql_safety("UPDATE users SET active = false")[0]

    assert len(analyze_sql_safety("UPDATE users SET active = false WHERE id = 10")) == 0


def test_safety_catches_drop_and_truncate():
    assert any("DROP" in w for w in analyze_sql_safety("DROP TABLE old_logs;"))
    assert any("TRUNCATE" in w for w in analyze_sql_safety("TRUNCATE TABLE metrics;"))


def test_is_mutation_statement():
    assert is_mutation_statement("SELECT * FROM users") is False
    assert is_mutation_statement("INSERT INTO users(name) VALUES ('Bob')") is True
    assert is_mutation_statement("UPDATE users SET name = 'Bob'") is True
    assert is_mutation_statement("DELETE FROM users") is True
    assert is_mutation_statement("DROP TABLE users") is True


# --- 2. Query Execution View Tests ---


def test_execute_query_requires_auth(api_client, test_connection):
    resp = api_client.post(f"/api/connections/{test_connection.id}/query/", {"sql": "SELECT 1"})
    assert resp.status_code == 403


def test_execute_query_cannot_access_other_users_connection(auth_client, user_factory):
    other = user_factory(email="other@example.com")
    theirs = Connection.objects.create(
        owner=other, name="theirs", engine="postgres", host="h", port=5432, db_name="d", username="u"
    )
    resp = auth_client.post(f"/api/connections/{theirs.id}/query/", {"sql": "SELECT 1"})
    assert resp.status_code == 404


def test_execute_query_success_and_history_logging(auth_client, test_connection, monkeypatch):
    mock_result = QueryResult(
        columns=[ColumnMeta(name="num", data_type="int4", generic_type="number")],
        column_names=["num"],
        rows=[{"num": 42}],
        row_count=1,
        duration_ms=8,
        truncated=False,
    )

    mock_driver = MagicMock()
    mock_driver.execute.return_value = mock_result
    monkeypatch.setattr("apps.queries.views.get_driver", lambda config: mock_driver)

    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/query/",
        {"sql": "SELECT 42 AS num", "limit": 500, "timeout": 15},
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["row_count"] == 1
    assert resp.data["rows"] == [{"num": 42}]
    assert "run_id" in resp.data

    # Verify QueryHistory entry was recorded
    history = QueryHistory.objects.filter(connection=test_connection).first()
    assert history is not None
    assert history.sql == "SELECT 42 AS num"
    assert history.status == QueryHistory.Status.SUCCESS
    assert history.duration_ms == 8
    assert history.row_count == 1


def test_execute_destructive_query_requires_confirmation(auth_client, test_connection, monkeypatch):
    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/query/",
        {"sql": "DELETE FROM users"},
    )
    assert resp.status_code == 422, resp.data
    assert resp.data["requires_confirmation"] is True
    assert len(resp.data["warnings"]) > 0

    # With confirmation flag set to True, query proceeds
    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult([], [], [], 5, 12, False)
    monkeypatch.setattr("apps.queries.views.get_driver", lambda config: mock_driver)

    confirmed_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/query/",
        {"sql": "DELETE FROM users", "confirm_destructive": True},
    )
    assert confirmed_resp.status_code == 200
    assert confirmed_resp.data["row_count"] == 5


def test_execute_mutation_on_read_only_connection_rejected(auth_client, read_only_connection):
    resp = auth_client.post(
        f"/api/connections/{read_only_connection.id}/query/",
        {"sql": "UPDATE accounts SET balance = 1000 WHERE id = 1"},
    )
    assert resp.status_code == 403
    assert "read-only mode" in resp.data["detail"]

    history = QueryHistory.objects.filter(connection=read_only_connection).first()
    assert history is not None
    assert history.status == QueryHistory.Status.BLOCKED


def test_execute_timeout_handling(auth_client, test_connection, monkeypatch):
    mock_driver = MagicMock()
    mock_driver.execute.side_effect = DriverTimeoutError("Query timed out after 5 seconds")
    monkeypatch.setattr("apps.queries.views.get_driver", lambda config: mock_driver)

    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/query/",
        {"sql": "SELECT pg_sleep(10)", "timeout": 5},
    )
    assert resp.status_code == 408
    assert "timed out" in resp.data["detail"]

    history = QueryHistory.objects.filter(connection=test_connection).first()
    assert history.status == QueryHistory.Status.TIMEOUT


def test_execute_cancelled_handling(auth_client, test_connection, monkeypatch):
    mock_driver = MagicMock()
    mock_driver.execute.side_effect = DriverCancelledError("Query was cancelled")
    monkeypatch.setattr("apps.queries.views.get_driver", lambda config: mock_driver)

    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/query/",
        {"sql": "SELECT pg_sleep(10)"},
    )
    assert resp.status_code == 499
    assert "cancelled" in resp.data["detail"]

    history = QueryHistory.objects.filter(connection=test_connection).first()
    assert history.status == QueryHistory.Status.CANCELLED


# --- 3. Cancel Query Tests ---


def test_cancel_query_success_and_not_found(auth_client, test_connection):
    # Unknown run_id
    resp = auth_client.post("/api/queries/non-existent-run/cancel/")
    assert resp.status_code == 404

    # Active run_id
    mock_driver = MagicMock()
    mock_driver.cancel.return_value = True
    run_tracker.register(
        run_id="run-active-123",
        connection_id=str(test_connection.id),
        engine="postgres",
        backend_id=9876,
        driver=mock_driver,
    )

    cancel_resp = auth_client.post("/api/queries/run-active-123/cancel/")
    assert cancel_resp.status_code == 200
    assert cancel_resp.data["ok"] is True
    mock_driver.cancel.assert_called_with("run-active-123")


def test_cancel_query_forbidden_on_other_users_connection(auth_client, user_factory):
    other = user_factory(email="other2@example.com")
    theirs = Connection.objects.create(
        owner=other, name="theirs2", engine="postgres", host="h", port=5432, db_name="d", username="u"
    )

    run_tracker.register(
        run_id="other-run-999",
        connection_id=str(theirs.id),
        engine="postgres",
        backend_id=1111,
    )

    resp = auth_client.post("/api/queries/other-run-999/cancel/")
    assert resp.status_code == 403


# --- 4. History API Tests ---


def test_query_history_list_and_filters(auth_client, user, test_connection):
    QueryHistory.objects.create(
        user=user, connection=test_connection, sql="SELECT 1", status="success", duration_ms=5
    )
    QueryHistory.objects.create(
        user=user, connection=test_connection, sql="SELECT 2", status="failed", duration_ms=10
    )

    resp = auth_client.get("/api/history/")
    assert resp.status_code == 200
    assert len(resp.data) == 2

    filtered = auth_client.get("/api/history/?status=failed")
    assert filtered.status_code == 200
    assert len(filtered.data) == 1
    assert filtered.data[0]["sql"] == "SELECT 2"


# --- 5. Saved Queries CRUD Tests ---


def test_saved_queries_crud(auth_client, test_connection):
    # 1. Create
    create_resp = auth_client.post(
        "/api/saved-queries/",
        {
            "connection": str(test_connection.id),
            "title": "Active Users",
            "sql": "SELECT * FROM users WHERE active = true",
            "tags": ["users", "reports"],
        },
        format="json",
    )
    assert create_resp.status_code == 201, create_resp.data
    saved_id = create_resp.data["id"]
    assert create_resp.data["title"] == "Active Users"
    assert create_resp.data["tags"] == ["users", "reports"]

    # 2. List
    list_resp = auth_client.get("/api/saved-queries/")
    assert list_resp.status_code == 200
    assert len(list_resp.data) == 1

    # 3. Update
    patch_resp = auth_client.patch(
        f"/api/saved-queries/{saved_id}/",
        {"title": "All Active Users"},
        format="json",
    )
    assert patch_resp.status_code == 200
    assert patch_resp.data["title"] == "All Active Users"

    # 4. Delete
    del_resp = auth_client.delete(f"/api/saved-queries/{saved_id}/")
    assert del_resp.status_code == 204
    assert SavedQuery.objects.count() == 0
