from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any

from .client import get_pusher_client

logger = logging.getLogger(__name__)


class EventType:
    """Standardized event names dispatched via Soketi / Pusher (PRD F14)."""

    QUERY_STARTED = "query.started"
    QUERY_PROGRESS = "query.progress"
    QUERY_COMPLETED = "query.completed"
    QUERY_FAILED = "query.failed"
    QUERY_CANCELLED = "query.cancelled"
    EXPORT_READY = "export.ready"
    SCHEMA_UPDATED = "schema.updated"


def get_user_channel(user_id: int | str) -> str:
    """Return the private channel name for a specific user."""
    return f"private-user-{user_id}"


def dispatch_user_event(user_id: int | str, event: str, data: dict[str, Any]) -> bool:
    """Publish an event to a user's private channel.

    Fails gracefully: if Soketi is unreachable or disabled, logs a warning
    and returns False rather than disrupting user workflows.
    """
    client = get_pusher_client()
    if client is None:
        return False

    channel = get_user_channel(user_id)
    payload = dict(data)
    payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())

    try:
        client.trigger(channel, event, payload)
        return True
    except Exception as exc:
        logger.warning(
            "Failed to dispatch real-time event '%s' to channel '%s': %s",
            event,
            channel,
            exc,
        )
        return False


def notify_query_started(
    user_id: int | str,
    run_id: str,
    connection_id: str,
    sql: str | None = None,
    database: str | None = None,
) -> bool:
    """Notify frontend that query execution has begun."""
    data: dict[str, Any] = {
        "run_id": run_id,
        "connection_id": str(connection_id),
    }
    if sql:
        data["sql"] = sql[:500]  # truncate long queries in WebSocket payload
    if database:
        data["database"] = database
    return dispatch_user_event(user_id, EventType.QUERY_STARTED, data)


def notify_query_progress(
    user_id: int | str,
    run_id: str,
    elapsed_ms: int,
    message: str | None = None,
) -> bool:
    """Notify frontend of query execution progress."""
    data: dict[str, Any] = {
        "run_id": run_id,
        "elapsed_ms": elapsed_ms,
    }
    if message:
        data["message"] = message
    return dispatch_user_event(user_id, EventType.QUERY_PROGRESS, data)


def notify_query_completed(
    user_id: int | str,
    run_id: str,
    connection_id: str,
    duration_ms: int,
    row_count: int,
) -> bool:
    """Notify frontend that query execution finished successfully.

    Per PRD F14: Result rows are intentionally never sent via WebSocket to keep
    payloads lightweight; the frontend retrieves data via REST.
    """
    data = {
        "run_id": run_id,
        "connection_id": str(connection_id),
        "duration_ms": duration_ms,
        "row_count": row_count,
        "status": "success",
    }
    return dispatch_user_event(user_id, EventType.QUERY_COMPLETED, data)


def notify_query_failed(
    user_id: int | str,
    run_id: str,
    connection_id: str,
    duration_ms: int,
    error: str,
    status: str = "failed",
) -> bool:
    """Notify frontend that query execution failed or timed out."""
    data = {
        "run_id": run_id,
        "connection_id": str(connection_id),
        "duration_ms": duration_ms,
        "error": error,
        "status": status,
    }
    return dispatch_user_event(user_id, EventType.QUERY_FAILED, data)


def notify_query_cancelled(
    user_id: int | str,
    run_id: str,
    connection_id: str,
) -> bool:
    """Notify frontend that query execution was cancelled."""
    data = {
        "run_id": run_id,
        "connection_id": str(connection_id),
        "status": "cancelled",
    }
    return dispatch_user_event(user_id, EventType.QUERY_CANCELLED, data)


def notify_schema_updated(
    user_id: int | str,
    connection_id: str,
) -> bool:
    """Notify frontend that cached schema metadata was refreshed."""
    data = {
        "connection_id": str(connection_id),
    }
    return dispatch_user_event(user_id, EventType.SCHEMA_UPDATED, data)
