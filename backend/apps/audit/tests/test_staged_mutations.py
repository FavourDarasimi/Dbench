import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.connections.models import Connection
from apps.drivers.base import DryRunResult, QueryResult


@pytest.fixture
def auth_user():
    return User.objects.create_user(email="dev@dbench.local", password="password123")


@pytest.fixture
def connection(auth_user):
    return Connection.objects.create(
        owner=auth_user,
        name="Inventory DB",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="inventory",
        username="postgres",
    )


@pytest.mark.django_db
class TestStagedMutations:
    def test_staged_mutations_preview(self, monkeypatch, auth_user, connection):
        monkeypatch.setattr(
            "apps.browser.mutations.schema_cache.get_tables",
            lambda conn, s: [{"name": "items", "type": "table"}],
        )
        monkeypatch.setattr(
            "apps.browser.mutations.schema_cache.get_columns",
            lambda conn, s, t: [
                {"name": "id", "data_type": "integer", "generic_type": "number", "is_primary_key": True},
                {"name": "name", "data_type": "text", "generic_type": "text", "is_primary_key": False},
                {"name": "qty", "data_type": "integer", "generic_type": "number", "is_primary_key": False},
            ],
        )

        class MockDriver:
            def execute_dry_run(self, sql, params=None, timeout=10):
                return DryRunResult(sql=sql, rows_affected=1, sample_rows=[], columns=[], duration_ms=2)

            def close(self):
                pass

        monkeypatch.setattr("apps.browser.mutations.get_driver", lambda cfg: MockDriver())

        client = APIClient()
        client.force_authenticate(user=auth_user)

        staged_items = [
            {"action": "update", "schema": "public", "table": "items", "pk": 1, "data": {"qty": 20}},
            {"action": "update", "schema": "public", "table": "items", "pk": 2, "data": {"qty": 50}},
        ]

        res = client.post(
            f"/api/connections/{connection.id}/staged-mutations/",
            {"staged_items": staged_items, "preview": True},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["preview"] is True
        assert data["staged_count"] == 2
        assert data["rows_affected"] == 2

    def test_staged_mutations_commit_creates_audit_entries(self, monkeypatch, auth_user, connection):
        monkeypatch.setattr(
            "apps.browser.mutations.schema_cache.get_tables",
            lambda conn, s: [{"name": "items", "type": "table"}],
        )
        monkeypatch.setattr(
            "apps.browser.mutations.schema_cache.get_columns",
            lambda conn, s, t: [
                {"name": "id", "data_type": "integer", "generic_type": "number", "is_primary_key": True},
                {"name": "name", "data_type": "text", "generic_type": "text", "is_primary_key": False},
                {"name": "qty", "data_type": "integer", "generic_type": "number", "is_primary_key": False},
            ],
        )

        class MockDriver:
            def execute(self, sql, params=None, limit=10, timeout=20):
                return QueryResult(columns=[], column_names=[], rows=[], row_count=1, duration_ms=3)

            def close(self):
                pass

        monkeypatch.setattr("apps.browser.mutations.get_driver", lambda cfg: MockDriver())

        client = APIClient()
        client.force_authenticate(user=auth_user)

        staged_items = [
            {
                "action": "update",
                "schema": "public",
                "table": "items",
                "pk": 10,
                "data": {"qty": 15},
                "originalData": {"id": 10, "name": "Item A", "qty": 10},
            },
            {
                "action": "insert",
                "schema": "public",
                "table": "items",
                "data": {"name": "Item B", "qty": 5},
            },
        ]

        res = client.post(
            f"/api/connections/{connection.id}/staged-mutations/",
            {"staged_items": staged_items, "preview": False},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["staged_count"] == 2
        assert len(data["audit_ids"]) == 2

        # Verify AuditLogs in DB
        audits = AuditLog.objects.filter(connection=connection)
        assert audits.count() == 2
