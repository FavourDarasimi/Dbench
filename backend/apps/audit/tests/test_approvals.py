import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import ChangeRequest
from apps.connections.models import Connection
from apps.drivers.base import DryRunResult, QueryResult


@pytest.fixture
def requester_user():
    return User.objects.create_user(email="junior_dev@dbench.local", password="password123")


@pytest.fixture
def reviewer_user():
    return User.objects.create_user(email="lead_dba@dbench.local", password="password123")


@pytest.fixture
def prod_connection(requester_user):
    return Connection.objects.create(
        owner=requester_user,
        name="Production Cluster",
        engine="postgres",
        host="prod-db.internal",
        port=5432,
        db_name="production",
        username="postgres",
        is_production=True,
        require_approval=True,
    )


@pytest.mark.django_db
class TestApprovalWorkflow:
    def test_production_write_intercepted_and_creates_change_request(
        self, monkeypatch, requester_user, prod_connection
    ):
        client = APIClient()
        client.force_authenticate(user=requester_user)

        # Mock dry run execution
        class MockDriver:
            def execute_dry_run(self, sql, params=None, timeout=20):
                return DryRunResult(
                    sql=sql,
                    rows_affected=5,
                    sample_rows=[{"id": 1, "status": "active"}],
                    columns=[],
                    duration_ms=4,
                )

            def close(self):
                pass

        monkeypatch.setattr("apps.audit.services.get_driver", lambda cfg: MockDriver())

        res = client.post(
            f"/api/connections/{prod_connection.id}/query/",
            {"sql": "UPDATE accounts SET status = 'suspended' WHERE balance < 0;"},
            format="json",
        )

        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data.get("requires_approval") is True
        assert "change_request_id" in data
        assert data["impact_summary"]["rows_affected"] == 5

        # Verify ChangeRequest in DB
        cr = ChangeRequest.objects.get(pk=data["change_request_id"])
        assert cr.status == ChangeRequest.Status.PENDING
        assert cr.requester == requester_user

    def test_self_approval_is_blocked(self, requester_user, prod_connection):
        cr = ChangeRequest.objects.create(
            connection=prod_connection,
            requester=requester_user,
            title="Update users",
            sql="UPDATE users SET active = false;",
            status=ChangeRequest.Status.PENDING,
        )

        client = APIClient()
        client.force_authenticate(user=requester_user)

        res = client.post(f"/api/change-requests/{cr.id}/approve/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "Self-approval is not permitted" in res.json()["detail"]

    def test_peer_approval_executes_successfully(
        self, monkeypatch, requester_user, reviewer_user, prod_connection
    ):
        cr = ChangeRequest.objects.create(
            connection=prod_connection,
            requester=requester_user,
            title="Fix balance typo",
            sql="UPDATE accounts SET balance = 500 WHERE id = 1;",
            status=ChangeRequest.Status.PENDING,
        )

        executed_sqls = []

        class MockDriver:
            def execute(self, sql, params=None, limit=10, timeout=30):
                executed_sqls.append(sql)
                return QueryResult(columns=[], column_names=[], rows=[], row_count=1, duration_ms=10)

            def close(self):
                pass

        monkeypatch.setattr("apps.audit.services.get_driver", lambda cfg: MockDriver())

        client = APIClient()
        client.force_authenticate(user=reviewer_user)

        res = client.post(f"/api/change-requests/{cr.id}/approve/")
        assert res.status_code == status.HTTP_200_OK

        cr.refresh_from_db()
        assert cr.status == ChangeRequest.Status.EXECUTED
        assert cr.reviewer == reviewer_user
        assert len(executed_sqls) == 1

    def test_peer_rejection_marks_rejected(self, requester_user, reviewer_user, prod_connection):
        cr = ChangeRequest.objects.create(
            connection=prod_connection,
            requester=requester_user,
            title="Dangerous query",
            sql="DROP TABLE audit_logs;",
            status=ChangeRequest.Status.PENDING,
        )

        client = APIClient()
        client.force_authenticate(user=reviewer_user)

        res = client.post(
            f"/api/change-requests/{cr.id}/reject/",
            {"comment": "Too dangerous, please specify table partitions instead."},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

        cr.refresh_from_db()
        assert cr.status == ChangeRequest.Status.REJECTED
        assert cr.reviewer == reviewer_user
        assert "Too dangerous" in cr.review_comment
