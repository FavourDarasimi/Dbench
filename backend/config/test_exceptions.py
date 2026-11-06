from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.drivers.base import (
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverReadOnlyError,
    DriverTimeoutError,
)
from config.exceptions import custom_exception_handler, sanitize_message


def test_sanitize_message_strips_passwords_and_coordinates():
    raw = (
        'connection to server at "ep-crimson-123.us-east-1.aws.neon.tech" (10.0.0.42), '
        'port 5432 failed: password="supersecretpass" password=anothersecret '
        'File "/run/media/kaiser/Projects/DBench/backend/drivers/postgres.py", line 42'
    )
    cleaned = sanitize_message(raw)
    assert "supersecretpass" not in cleaned
    assert "anothersecret" not in cleaned
    assert "10.0.0.42" not in cleaned
    assert "ep-crimson-123.us-east-1.aws.neon.tech" not in cleaned
    assert "/run/media/kaiser" not in cleaned
    assert "password=" in cleaned


def test_sanitize_message_normalizes_connection_lost():
    raw = "psycopg.OperationalError: the connection is lost"
    cleaned = sanitize_message(raw)
    assert "database connection was lost" in cleaned.lower()


def test_custom_exception_handler_drf_validation():
    exc = ValidationError({"host": "host at 192.168.1.5 port 5432 is invalid"})
    response = custom_exception_handler(exc, {})
    assert response is not None
    assert response.status_code == 400
    assert "192.168.1.5" not in str(response.data["host"])


def test_custom_exception_handler_driver_connection_error():
    exc = DriverConnectionError(
        'psycopg.OperationalError: connection to server at "ep-neon.aws.neon.tech" (3.230.1.1), port 5432 failed: Connection refused'
    )
    response = custom_exception_handler(exc, {})
    assert response is not None
    assert response.status_code == 503
    assert response.data["code"] == "database_connection_lost"
    assert "3.230.1.1" not in response.data["detail"]
    assert "ep-neon.aws.neon.tech" not in response.data["detail"]


def test_custom_exception_handler_driver_timeout():
    exc = DriverTimeoutError("canceling statement due to statement timeout")
    response = custom_exception_handler(exc, {})
    assert response is not None
    assert response.status_code == 408
    assert response.data["code"] == "query_timeout"


def test_custom_exception_handler_driver_auth():
    exc = DriverAuthenticationError("password authentication failed for user 'root'")
    response = custom_exception_handler(exc, {})
    assert response is not None
    assert response.status_code == 401
    assert response.data["code"] == "database_auth_failed"


def test_custom_exception_handler_driver_readonly():
    exc = DriverReadOnlyError("cannot execute INSERT in read-only transaction")
    response = custom_exception_handler(exc, {})
    assert response is not None
    assert response.status_code == 403
    assert response.data["code"] == "read_only_mode"


def test_custom_exception_handler_uncaught_server_error():
    exc = KeyError("missing_internal_column_key")
    response = custom_exception_handler(exc, {"view": "FakeView"})
    assert response is not None
    assert response.status_code == 500
    assert response.data["code"] == "internal_server_error"
    assert "missing_internal_column_key" not in response.data["detail"]
    assert "Traceback" not in response.data["detail"]
    assert "<!DOCTYPE html>" not in response.data["detail"]
