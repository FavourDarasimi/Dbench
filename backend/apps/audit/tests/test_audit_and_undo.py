import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.audit.services import compute_diff, execute_undo, record_audit
from apps.connections.models import Connection
from apps.drivers.base import QueryResult


@pytest.fixture
def auth_user():
    return User.objects.create_user(email="alice@dbench.local", password="password123")


@pytest.fixture
def other_user():
    return User.objects.create_user(email="bob@dbench.local", password="password123")


@pytest.fixture
def test_conn(auth_user):
    return Connection.objects.create(
        owner=auth_user,
        name="Finance DB",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="finances",
        username="postgres",
    )


@pytest.mark.django_db
class TestAuditAndUndo:
    def test_compute_diff(self):
        before = {"id": 1, "status": "pending", "amount": 100}
        after = {"id": 1, "status": "completed", "amount": 100}
        diff = compute_diff(before, after)
        assert "status" in diff
        assert diff["status"] == {"old": "pending", "new": "completed"}
        assert "amount" not in diff

    def test_record_audit_and_list_api(self, auth_user, test_conn):
        entry = record_audit(
            connection=test_conn,
            user=auth_user,
            action=AuditLog.Action.UPDATE,
            schema_name="public",
            table_name="orders",
            record_pk="101",
            before_state={"id": 101, "status": "draft"},
            after_state={"id": 101, "status": "paid"},
            sql='UPDATE "public"."orders" SET "status" = \'paid\' WHERE "id" = 101;',
            rows_affected=1,
            reversible=True,
        )

        client = APIClient()
        client.force_authenticate(user=auth_user)

        res = client.get(f"/api/connections/{test_conn.id}/audit/")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["total"] == 1
        assert data["results"][0]["table_name"] == "orders"
        assert data["results"][0]["diff"]["status"]["old"] == "draft"
        assert data["results"][0]["diff"]["status"]["new"] == "paid"

    def test_execute_undo_for_update(self, monkeypatch, auth_user, test_conn):
        entry = record_audit(
            connection=test_conn,
            user=auth_user,
            action=AuditLog.Action.UPDATE,
            schema_name="public",
            table_name="customers",
            record_pk="5",
            before_state={"id": 5, "name": "Original Name", "tier": "gold"},
            after_state={"id": 5, "name": "Accidental Typo", "tier": "gold"},
            sql='UPDATE "public"."customers" SET "name" = \'Accidental Typo\' WHERE "id" = 5;',
            rows_affected=1,
            reversible=True,
        )

        # Mock schema cache to return primary key
        monkeypatch.setattr(
            "apps.audit.services.schema_cache.get_columns",
            lambda conn, s, t: [
                {"name": "id", "is_primary_key": True, "generic_type": "number"},
                {"name": "name", "is_primary_key": False, "generic_type": "text"},
                {"name": "tier", "is_primary_key": False, "generic_type": "text"},
            ],
        )

        executed_sqls = []

        class MockDriver:
            def execute(self, sql, params=None, limit=10, timeout=20):
                executed_sqls.append((sql, params))
                return QueryResult(columns=[], column_names=[], rows=[], row_count=1, duration_ms=5)

            def close(self):
                pass

        monkeypatch.setattr("apps.audit.services.get_driver", lambda cfg: MockDriver())

        client = APIClient()
        client.force_authenticate(user=auth_user)

        res = client.post(f"/api/audit/{entry.id}/undo/")
        assert res.status_code == status.HTTP_200_OK

        entry.refresh_from_db()
        assert entry.undone_at is not None
        assert entry.undone_by == auth_user

        # Verify an UNDO audit log was created
        undo_logs = AuditLog.objects.filter(action=AuditLog.Action.UNDO)
        assert undo_logs.count() == 1
        assert len(executed_sqls) == 1
        assert "UPDATE" in executed_sqls[0][0]
        assert "Original Name" in executed_sqls[0][1]

    def test_audit_export_csv_and_json(self, auth_user, test_conn):
        record_audit(
            connection=test_conn,
            user=auth_user,
            action=AuditLog.Action.INSERT,
            schema_name="public",
            table_name="logs",
            record_pk="1",
            after_state={"id": 1, "msg": "hello"},
            sql="INSERT INTO logs VALUES (1, 'hello');",
        )

        client = APIClient()
        client.force_authenticate(user=auth_user)

        # CSV export
        res_csv = client.get(f"/api/connections/{test_conn.id}/audit/export/?format=csv")
        assert res_csv.status_code == status.HTTP_200_OK
        assert "text/csv" in res_csv["Content-Type"]

        # JSON export
        res_json = client.get(f"/api/connections/{test_conn.id}/audit/export/?format=json")
        assert res_json.status_code == status.HTTP_200_OK
        assert "application/json" in res_json["Content-Type"]
