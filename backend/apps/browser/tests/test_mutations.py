from unittest.mock import MagicMock
from django.core.cache import cache
import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.browser.mutations import MutationBuilder, execute_row_mutation
from apps.connections.crypto import encrypt
from apps.connections.models import Connection
from apps.drivers.base import ColumnMeta, QueryResult
from apps.queries.models import QueryHistory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def table_columns():
    return [
        ColumnMeta(name="id", data_type="int4", generic_type="number", nullable=False, is_primary_key=True),
        ColumnMeta(name="name", data_type="varchar", generic_type="text", nullable=False),
        ColumnMeta(name="email", data_type="varchar", generic_type="text", nullable=True),
    ]


@pytest.fixture
def no_pk_columns():
    return [
        ColumnMeta(name="metric_name", data_type="varchar", generic_type="text", nullable=False, is_primary_key=False),
        ColumnMeta(name="value", data_type="float8", generic_type="number", nullable=False, is_primary_key=False),
    ]


@pytest.fixture
def test_connection(user):
    return Connection.objects.create(
        owner=user,
        name="mutation-db",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
        encrypted_password=encrypt("pass"),
        read_only=False,
    )


@pytest.fixture
def ro_connection(user):
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


# --- 1. MutationBuilder Unit Tests ---


def test_builder_insert(table_columns):
    builder = MutationBuilder("public", "users", table_columns, "postgres")
    sql, params = builder.build_insert({"name": "Alice", "email": "a@b.com"})
    assert 'INSERT INTO "public"."users" ("name", "email") VALUES (%s, %s)' in sql
    assert sql.endswith("RETURNING *;")
    assert params == ["Alice", "a@b.com"]

    with pytest.raises(ValidationError):
        builder.build_insert({})

    with pytest.raises(ValidationError):
        builder.build_insert({"non_existent_column": "value"})


def test_builder_update(table_columns):
    builder = MutationBuilder("public", "users", table_columns, "postgres")
    sql, params = builder.build_update(pk_value=10, data={"name": "Alice Cooper"})
    assert 'UPDATE "public"."users" SET "name" = %s WHERE "id" = %s' in sql
    assert params == ["Alice Cooper", 10]

    with pytest.raises(ValidationError):
        builder.build_update(10, {})


def test_builder_update_rejects_table_without_pk(no_pk_columns):
    builder = MutationBuilder("public", "metrics", no_pk_columns, "postgres")
    with pytest.raises(ValidationError) as exc:
        builder.build_update(1, {"value": 12.5})
    assert "has no primary key" in str(exc.value)


def test_builder_delete(table_columns):
    builder = MutationBuilder("public", "users", table_columns, "postgres")
    sql, params = builder.build_delete(pk_value=42)
    assert sql == 'DELETE FROM "public"."users" WHERE "id" = %s;'
    assert params == [42]


def test_builder_bulk_delete(table_columns):
    builder = MutationBuilder("public", "users", table_columns, "postgres")
    sql, params = builder.build_bulk_delete([1, 2, 3])
    assert sql == 'DELETE FROM "public"."users" WHERE "id" IN (%s, %s, %s);'
    assert params == [1, 2, 3]

    with pytest.raises(ValidationError):
        builder.build_bulk_delete([])


# --- 2. API Endpoint & Service Tests ---


def setup_mock_tables(monkeypatch, table_columns, table_type="table"):
    monkeypatch.setattr(
        "apps.browser.mutations.schema_cache.get_tables",
        lambda conn, schema: [{"name": "users", "schema": schema, "type": table_type}],
    )
    monkeypatch.setattr(
        "apps.browser.mutations.schema_cache.get_columns",
        lambda conn, schema, table: [c.to_dict() for c in table_columns],
    )
    monkeypatch.setattr(
        "apps.browser.views.schema_cache.get_tables",
        lambda conn, schema: [{"name": "users", "schema": schema, "type": table_type}],
    )
    monkeypatch.setattr(
        "apps.browser.views.schema_cache.get_columns",
        lambda conn, schema, table: [c.to_dict() for c in table_columns],
    )


def test_general_mutation_insert_and_preview(auth_client, test_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns)

    # 1. Preview mode (confirm-before-commit)
    preview_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {
            "action": "insert",
            "schema": "public",
            "table": "users",
            "data": {"name": "Bob", "email": "bob@example.com"},
            "preview": True,
        },
        format="json",
    )
    assert preview_resp.status_code == 200, preview_resp.data
    assert preview_resp.data["preview"] is True
    assert "INSERT INTO" in preview_resp.data["sql"]

    # 2. Execution mode
    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult([], [], [{"id": 1, "name": "Bob", "email": "bob@example.com"}], 1, 12, False)
    monkeypatch.setattr("apps.browser.mutations.get_driver", lambda config: mock_driver)

    exec_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {
            "action": "insert",
            "schema": "public",
            "table": "users",
            "data": {"name": "Bob", "email": "bob@example.com"},
            "preview": False,
        },
        format="json",
    )
    assert exec_resp.status_code == 200, exec_resp.data
    assert exec_resp.data["preview"] is False
    assert exec_resp.data["rows_affected"] == 1
    assert exec_resp.data["row"]["name"] == "Bob"

    # QueryHistory logged
    history = QueryHistory.objects.filter(connection=test_connection, source="browser").first()
    assert history is not None
    assert "INSERT INTO" in history.sql


def test_general_mutation_update_and_delete(auth_client, test_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns)

    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult([], [], [{"id": 10, "name": "Alice New"}], 1, 8, False)
    monkeypatch.setattr("apps.browser.mutations.get_driver", lambda config: mock_driver)

    # Update
    update_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {
            "action": "update",
            "schema": "public",
            "table": "users",
            "pk": "10",
            "data": {"name": "Alice New"},
        },
        format="json",
    )
    assert update_resp.status_code == 200, update_resp.data
    assert update_resp.data["rows_affected"] == 1

    # Delete
    del_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {
            "action": "delete",
            "schema": "public",
            "table": "users",
            "pk": "10",
        },
        format="json",
    )
    assert del_resp.status_code == 200
    assert del_resp.data["rows_affected"] == 1


def test_restful_table_endpoints(auth_client, test_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns)

    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult([], [], [{"id": 1, "name": "Charlie"}], 1, 10, False)
    monkeypatch.setattr("apps.browser.mutations.get_driver", lambda config: mock_driver)

    # POST (Insert)
    post_resp = auth_client.post(
        f"/api/connections/{test_connection.id}/tables/users/rows/",
        {"name": "Charlie", "email": "c@example.com"},
        format="json",
    )
    assert post_resp.status_code == 201, post_resp.data
    assert post_resp.data["rows_affected"] == 1

    # PATCH (Update)
    patch_resp = auth_client.patch(
        f"/api/connections/{test_connection.id}/tables/users/rows/1/",
        {"name": "Charlie Chaplin"},
        format="json",
    )
    assert patch_resp.status_code == 200, patch_resp.data
    assert patch_resp.data["rows_affected"] == 1

    # DELETE single
    del_resp = auth_client.delete(f"/api/connections/{test_connection.id}/tables/users/rows/1/")
    assert del_resp.status_code == 200, del_resp.data

    # DELETE bulk
    bulk_del_resp = auth_client.delete(
        f"/api/connections/{test_connection.id}/tables/users/rows/",
        {"pks": [1, 2, 3]},
        format="json",
    )
    assert bulk_del_resp.status_code == 200, bulk_del_resp.data


def test_mutations_blocked_on_read_only_connection(auth_client, ro_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns)

    resp = auth_client.post(
        f"/api/connections/{ro_connection.id}/rows/",
        {"action": "insert", "schema": "public", "table": "users", "data": {"name": "Hacker"}},
        format="json",
    )
    assert resp.status_code == 403
    assert "read-only mode" in resp.data["detail"]


def test_mutations_blocked_on_views(auth_client, test_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns, table_type="view")

    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {"action": "insert", "schema": "public", "table": "users", "data": {"name": "Test"}},
        format="json",
    )
    assert resp.status_code == 400
    assert "view" in str(resp.data)


def test_constraint_error_translation(auth_client, test_connection, table_columns, monkeypatch):
    setup_mock_tables(monkeypatch, table_columns)

    mock_driver = MagicMock()
    mock_driver.execute.side_effect = RuntimeError("duplicate key value violates unique constraint 'users_email_key'")
    monkeypatch.setattr("apps.browser.mutations.get_driver", lambda config: mock_driver)

    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/rows/",
        {"action": "insert", "schema": "public", "table": "users", "data": {"name": "Bob", "email": "dup@b.com"}},
        format="json",
    )
    assert resp.status_code == 400
    assert "violates a unique constraint" in str(resp.data)
