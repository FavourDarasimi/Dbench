from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.connections.models import Connection
from apps.notifications.client import get_pusher_client, reset_pusher_client
from apps.notifications.events import (
    EventType,
    dispatch_user_event,
    get_user_channel,
    notify_query_cancelled,
    notify_query_completed,
    notify_query_failed,
    notify_query_progress,
    notify_query_started,
    notify_schema_updated,
)

User = get_user_model()


@pytest.fixture(autouse=True)
def clean_client():
    reset_pusher_client()
    yield
    reset_pusher_client()


@pytest.fixture
def auth_client():
    user = User.objects.create_user(
        email="realtime_user@example.com",
        password="ValidPassword123!",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def other_user():
    return User.objects.create_user(
        email="other_realtime@example.com",
        password="ValidPassword123!",
    )


@pytest.mark.django_db
class TestPusherAuthEndpoint:
    """Tests for POST /api/pusher/auth/ (PRD F14)."""

    url = "/api/pusher/auth/"

    def test_unauthenticated_request_rejected(self):
        client = APIClient()
        response = client.post(
            self.url,
            {"socket_id": "123.456", "channel_name": "private-user-1"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN or response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_successful_auth_private_user_channel_json(self, auth_client):
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "1234.5678",
                "channel_name": f"private-user-{user.id}",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "auth" in data
        assert isinstance(data["auth"], str)
        assert data["auth"].startswith("app-key:")

    def test_successful_auth_form_urlencoded(self, auth_client):
        """Pusher-js sends application/x-www-form-urlencoded by default."""
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "999.888",
                "channel_name": f"private-user-{user.id}",
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "auth" in data
        assert data["auth"].startswith("app-key:")

    def test_forbidden_when_authorizing_other_user_channel(self, auth_client, other_user):
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "1234.5678",
                "channel_name": f"private-user-{other_user.id}",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "not authorized" in response.json()["detail"].lower()

    def test_forbidden_for_arbitrary_channel_name(self, auth_client):
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "1234.5678",
                "channel_name": "private-global-admin",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_missing_required_parameters(self, auth_client):
        client, user = auth_client
        response = client.post(self.url, {"socket_id": "1234.5678"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_presence_channel_authorization(self, auth_client):
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "1234.5678",
                "channel_name": f"presence-user-{user.id}",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "auth" in data
        assert "channel_data" in data

    def test_service_unavailable_when_disabled(self, auth_client, settings):
        settings.SOKETI_ENABLED = False
        reset_pusher_client()
        client, user = auth_client
        response = client.post(
            self.url,
            {
                "socket_id": "1234.5678",
                "channel_name": f"private-user-{user.id}",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


@pytest.mark.django_db
class TestEventDispatching:
    """Tests for Soketi event dispatcher and helper functions."""

    def test_get_user_channel(self):
        assert get_user_channel(42) == "private-user-42"
        assert get_user_channel("uuid-string") == "private-user-uuid-string"

    def test_dispatch_user_event_success(self):
        with patch("apps.notifications.client.pusher.Pusher.trigger") as mock_trigger:
            success = dispatch_user_event(
                user_id=10,
                event=EventType.QUERY_STARTED,
                data={"run_id": "run-123"},
            )
            assert success is True
            mock_trigger.assert_called_once()
            channel, event, payload = mock_trigger.call_args[0]
            assert channel == "private-user-10"
            assert event == EventType.QUERY_STARTED
            assert payload["run_id"] == "run-123"
            assert "timestamp" in payload

    def test_dispatch_user_event_failure_resilience(self):
        """Network/Soketi errors must never crash caller workflows."""
        with patch(
            "apps.notifications.client.pusher.Pusher.trigger",
            side_effect=ConnectionError("Failed to connect to Soketi"),
        ):
            success = dispatch_user_event(
                user_id=10,
                event=EventType.QUERY_COMPLETED,
                data={"run_id": "run-456"},
            )
            assert success is False

    def test_dispatch_when_disabled(self, settings):
        settings.SOKETI_ENABLED = False
        reset_pusher_client()
        success = dispatch_user_event(
            user_id=10,
            event=EventType.QUERY_STARTED,
            data={},
        )
        assert success is False

    def test_all_helper_functions(self):
        with patch("apps.notifications.events.dispatch_user_event") as mock_dispatch:
            mock_dispatch.return_value = True

            notify_query_started(1, "run-1", "conn-1", sql="SELECT 1")
            mock_dispatch.assert_called_with(
                1,
                EventType.QUERY_STARTED,
                {"run_id": "run-1", "connection_id": "conn-1", "sql": "SELECT 1"},
            )

            notify_query_progress(1, "run-1", elapsed_ms=500, message="Executing")
            mock_dispatch.assert_called_with(
                1,
                EventType.QUERY_PROGRESS,
                {"run_id": "run-1", "elapsed_ms": 500, "message": "Executing"},
            )

            notify_query_completed(1, "run-1", "conn-1", duration_ms=120, row_count=5)
            mock_dispatch.assert_called_with(
                1,
                EventType.QUERY_COMPLETED,
                {
                    "run_id": "run-1",
                    "connection_id": "conn-1",
                    "duration_ms": 120,
                    "row_count": 5,
                    "status": "success",
                },
            )

            notify_query_failed(1, "run-1", "conn-1", duration_ms=50, error="boom")
            mock_dispatch.assert_called_with(
                1,
                EventType.QUERY_FAILED,
                {
                    "run_id": "run-1",
                    "connection_id": "conn-1",
                    "duration_ms": 50,
                    "error": "boom",
                    "status": "failed",
                },
            )

            notify_query_cancelled(1, "run-1", "conn-1")
            mock_dispatch.assert_called_with(
                1,
                EventType.QUERY_CANCELLED,
                {
                    "run_id": "run-1",
                    "connection_id": "conn-1",
                    "status": "cancelled",
                },
            )

            notify_schema_updated(1, "conn-1")
            mock_dispatch.assert_called_with(
                1,
                EventType.SCHEMA_UPDATED,
                {"connection_id": "conn-1"},
            )


@pytest.mark.django_db
class TestQueryExecutionRealTimeEvents:
    """Integration test verifying query endpoints dispatch real-time events."""

    def test_query_execution_dispatches_events(self, auth_client):
        client, user = auth_client
        conn = Connection.objects.create(
            name="Test PG",
            engine=Connection.Engine.POSTGRES,
            host="localhost",
            port=5432,
            db_name="testdb",
            username="postgres",
            owner=user,
        )

        with patch("apps.queries.views.get_driver") as mock_get_driver, \
             patch("apps.queries.views.notify_query_started") as mock_started, \
             patch("apps.queries.views.notify_query_completed") as mock_completed:

            mock_driver = MagicMock()
            mock_driver.execute.return_value = MagicMock(
                duration_ms=42,
                row_count=1,
                to_dict=lambda: {"columns": [], "rows": [], "duration_ms": 42, "row_count": 1},
            )
            mock_get_driver.return_value = mock_driver

            resp = client.post(
                f"/api/connections/{conn.id}/query/",
                {"sql": "SELECT 1"},
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK

            mock_started.assert_called_once()
            assert mock_started.call_args[1]["user_id"] == user.id
            assert mock_started.call_args[1]["sql"] == "SELECT 1"

            mock_completed.assert_called_once()
            assert mock_completed.call_args[1]["user_id"] == user.id
            assert mock_completed.call_args[1]["duration_ms"] == 42
            assert mock_completed.call_args[1]["row_count"] == 1
