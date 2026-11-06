from __future__ import annotations

import logging
import re
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.drivers.base import (
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
)

logger = logging.getLogger(__name__)

# Sensitive coordinate patterns to scrub from all API error outputs
_PASS_PATTERN = re.compile(r'password=".*?"|password=\S+', re.IGNORECASE)
_IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_HOST_PATTERN = re.compile(
    r'(?:server at|host)\s+"(?:[\w\.-]+)"|(?:[\w\.-]+\.[\w\.-]+\.(?:neon\.tech|amazonaws\.com|database\.azure\.com))',
    re.IGNORECASE,
)
_PORT_PATTERN = re.compile(r"port\s+\d+", re.IGNORECASE)
_FILE_PATH_PATTERN = re.compile(r"(?:/[a-zA-Z0-9_\.-]+)+/[a-zA-Z0-9_\.-]+\.py", re.IGNORECASE)


def sanitize_message(msg: str) -> str:
    """Sanitize internal coordinates, IP addresses, database hostnames, and system paths from error messages."""
    if not isinstance(msg, str) or not msg.strip():
        return msg

    # Strip passwords first
    clean = _PASS_PATTERN.sub('password="***"', msg)
    # Strip full server hostnames
    clean = _HOST_PATTERN.sub("database server", clean)
    # Strip IP addresses
    clean = _IP_PATTERN.sub("<database-host>", clean)
    # Strip port numbers
    clean = _PORT_PATTERN.sub("port <port>", clean)
    # Strip filesystem paths
    clean = _FILE_PATH_PATTERN.sub("<source_file>", clean)

    # Simplify noisy driver prefixes
    clean = re.sub(
        r"^(?:psycopg_binary\.pq\.|psycopg\.|pymysql\.err\.|django\.db\.utils\.)?"
        r"(?:OperationalError|DatabaseError|ProgrammingError|InternalError|DriverError|Error):\s*",
        "",
        clean,
        flags=re.IGNORECASE,
    )

    # Normalize specific common connection error messages
    lower = clean.lower()
    if "connection refused" in lower:
        return "Connection refused: Unable to reach the target database. Please verify database connectivity."

    if (
        "the connection is lost" in lower
        or "could not connect to server" in lower
        or "server closed the connection unexpectedly" in lower
    ):
        return "Database connection was lost. Please verify database connectivity."

    if "password authentication failed" in lower or "access denied for user" in lower:
        return "Database authentication failed: password authentication failed for the specified user."

    return clean.strip()


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """
    Global exception handler for Django REST Framework.
    Guarantees that:
    1. All error responses are clean, structured JSON (never raw Django HTML debug pages).
    2. Sensitive infrastructure details (hostnames, IP addresses, database passwords) are sanitized.
    3. Uncaught exceptions are logged internally and return a safe HTTP 500 payload.
    """
    # 1. Let DRF handle standard REST framework exceptions (ValidationError, NotFound, PermissionDenied, etc.)
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(response.data, dict):
            for k, v in list(response.data.items()):
                if isinstance(v, str):
                    response.data[k] = sanitize_message(v)
                elif isinstance(v, list):
                    response.data[k] = [
                        sanitize_message(item) if isinstance(item, str) else item for item in v
                    ]
        elif isinstance(response.data, list):
            response.data = [
                sanitize_message(item) if isinstance(item, str) else item for item in response.data
            ]
        elif isinstance(response.data, str):
            response.data = sanitize_message(response.data)
        return response

    # 2. Translate driver exceptions into appropriate structured HTTP responses
    if isinstance(exc, DriverAuthenticationError):
        return Response(
            {
                "detail": "Database authentication failed. Please check your username and password.",
                "code": "database_auth_failed",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, DriverConnectionError):
        return Response(
            {
                "detail": sanitize_message(str(exc)) or "Unable to connect to the target database.",
                "code": "database_connection_lost",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if isinstance(exc, DriverTimeoutError):
        return Response(
            {
                "detail": "Database query exceeded the timeout limit.",
                "code": "query_timeout",
            },
            status=status.HTTP_408_REQUEST_TIMEOUT,
        )

    if isinstance(exc, DriverReadOnlyError):
        return Response(
            {
                "detail": "Database mutations are not permitted on read-only connections.",
                "code": "read_only_mode",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, DriverCancelledError):
        return Response(
            {
                "detail": "Query execution was cancelled.",
                "code": "query_cancelled",
            },
            status=499,
        )

    if isinstance(exc, (DriverQueryError, DriverError)):
        return Response(
            {
                "detail": sanitize_message(str(exc)),
                "code": "database_query_error",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 3. Uncaught exceptions (KeyError, AttributeError, ValueError, unhandled library errors)
    view_name = context.get("view", None)
    logger.exception("Unhandled API exception in %s: %s", view_name, exc)

    return Response(
        {
            "detail": "An internal server error occurred. Please try again later.",
            "code": "internal_server_error",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
