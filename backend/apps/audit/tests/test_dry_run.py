import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.connections.models import Connection
from apps.drivers.base import DryRunResult


@pytest.fixture
def auth_user():
    return User.objects.create_user(email="developer@dbench.local", password="password123")


@pytest.fixture
def test_connection(auth_user):
    return Connection.objects.create(
        owner=auth_user,
        name="Test PostgreSQL",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
    )


@pytest.mark.django_db
class TestDryRunEngine:
    def test_dry_run_endpoint_runs_and_rolls_back(self, monkeypatch, auth_user, test_connection):
        client = APIClient()
        client.force_authenticate(user=auth_user)

        # Mock driver.execute_dry_run
        mock_result = DryRunResult(
            sql="DELETE FROM products WHERE price > 100;",
            rows_affected=42,
            sample_rows=[{"id": 1, "name": "Laptop", "price": 1200}],
            columns=[],
            duration_ms=15,
            warnings=[],
        )

        class MockDriver:
            def execute_dry_run(self, sql, params=None, timeout=30):
                return mock_result

            def close(self):
                pass

        monkeypatch.setattr("apps.audit.views.get_driver", lambda config: MockDriver())

        res = client.post(
            f"/api/connections/{test_connection.id}/dry-run/",
            {"sql": "DELETE FROM products WHERE price > 100;"},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["rows_affected"] == 42
        assert len(data["sample_rows"]) == 1
        assert data["sample_rows"][0]["name"] == "Laptop"

    def test_query_editor_dry_run_flag(self, monkeypatch, auth_user, test_connection):
        client = APIClient()
        client.force_authenticate(user=auth_user)

        mock_result = DryRunResult(
            sql="UPDATE users SET active = false;",
            rows_affected=150,
            sample_rows=[{"id": "u1", "email": "test@example.com"}],
            columns=[],
            duration_ms=8,
            warnings=[],
        )

        class MockDriver:
            def execute_dry_run(self, sql, params=None, timeout=30):
                return mock_result

            def close(self):
                pass

        monkeypatch.setattr("apps.queries.views.get_driver", lambda config: MockDriver())

        res = client.post(
            f"/api/connections/{test_connection.id}/query/",
            {
                "sql": "UPDATE users SET active = false;",
                "dry_run": True,
            },
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["rows_affected"] == 150
        assert data["sample_rows"][0]["email"] == "test@example.com"
