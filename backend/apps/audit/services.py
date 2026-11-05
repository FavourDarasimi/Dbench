from __future__ import annotations

import logging
from typing import Any
import uuid

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.factory import get_driver
from apps.explorer.services import schema_cache
from .models import AuditLog, ChangeRequest

logger = logging.getLogger(__name__)


def compute_diff(before: dict[str, Any] | None, after: dict[str, Any] | None) -> dict[str, Any]:
    """Compute field-by-field differences between before and after states."""
    if before is None or after is None:
        return {}

    diff: dict[str, Any] = {}
    all_keys = set(before.keys()) | set(after.keys())
    for k in all_keys:
        old_val = before.get(k)
        new_val = after.get(k)
        if old_val != new_val:
            diff[k] = {"old": old_val, "new": new_val}
    return diff


def record_audit(
    connection: Connection,
    user: Any,
    action: str,
    schema_name: str = "",
    table_name: str = "",
    record_pk: str = "",
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    sql: str = "",
    rows_affected: int = 1,
    reversible: bool = False,
    source: str = AuditLog.Source.BROWSER,
) -> AuditLog:
    """Record a row-level mutation in the audit log."""
    diff = compute_diff(before_state, after_state)
    return AuditLog.objects.create(
        connection=connection,
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        schema_name=schema_name,
        table_name=table_name,
        record_pk=str(record_pk) if record_pk is not None else "",
        before_state=before_state,
        after_state=after_state,
        diff=diff,
        sql=sql,
        rows_affected=rows_affected,
        reversible=reversible,
        source=source,
    )


def generate_inverse_mutation(audit_entry: AuditLog) -> tuple[str, list[Any]]:
    """Generate the inverse SQL operation to undo a recorded mutation."""
    connection = audit_entry.connection
    dialect = "postgres" if connection.engine == "postgres" else "mysql"

    quote_char = '"' if dialect == "postgres" else "`"

    def quote_ident(ident: str) -> str:
        escaped = ident.replace(quote_char, quote_char * 2)
        return f"{quote_char}{escaped}{quote_char}"

    schema = audit_entry.schema_name
    table = audit_entry.table_name
    table_ref = f"{quote_ident(schema)}.{quote_ident(table)}" if schema else quote_ident(table)

    # 1. Undo UPDATE -> Restore before_state
    if audit_entry.action == AuditLog.Action.UPDATE:
        if not audit_entry.before_state or not audit_entry.record_pk:
            raise ValidationError("Cannot undo update: Missing before-state snapshot or primary key.")

        # Discover primary key column name from cached metadata
        cols = schema_cache.get_columns(connection, schema, table)
        pk_col = next((c["name"] for c in cols if c.get("is_primary_key")), "id")

        set_clauses: list[str] = []
        params: list[Any] = []
        for col, val in audit_entry.before_state.items():
            if col == pk_col:
                continue
            set_clauses.append(f"{quote_ident(col)} = %s")
            params.append(val)

        if not set_clauses:
            raise ValidationError("No previous field values to restore.")

        sql = f"UPDATE {table_ref} SET {', '.join(set_clauses)} WHERE {quote_ident(pk_col)} = %s;"
        params.append(audit_entry.record_pk)
        return sql, params

    # 2. Undo INSERT -> Delete inserted record by PK
    elif audit_entry.action == AuditLog.Action.INSERT:
        if not audit_entry.record_pk:
            raise ValidationError("Cannot undo insert: Missing primary key of inserted record.")

        cols = schema_cache.get_columns(connection, schema, table)
        pk_col = next((c["name"] for c in cols if c.get("is_primary_key")), "id")

        sql = f"DELETE FROM {table_ref} WHERE {quote_ident(pk_col)} = %s;"
        return sql, [audit_entry.record_pk]

    # 3. Undo DELETE -> Re-insert before_state
    elif audit_entry.action == AuditLog.Action.DELETE:
        if not audit_entry.before_state:
            raise ValidationError("Cannot undo deletion: Missing record snapshot.")

        cols = list(audit_entry.before_state.keys())
        params = list(audit_entry.before_state.values())
        quoted_cols = [quote_ident(c) for c in cols]
        placeholders = ["%s"] * len(cols)

        sql = f"INSERT INTO {table_ref} ({', '.join(quoted_cols)}) VALUES ({', '.join(placeholders)});"
        return sql, params

    else:
        raise ValidationError(f"Action '{audit_entry.action}' is not reversible via one-click undo.")


def execute_undo(audit_id: str | uuid.UUID, user: Any) -> AuditLog:
    """Execute the inverse mutation and log an UNDO audit entry."""
    audit_entry = AuditLog.objects.select_related("connection").get(pk=audit_id)
    if not audit_entry.reversible:
        raise ValidationError("This change is not marked as reversible.")
    if audit_entry.undone_at:
        raise ValidationError(f"This change was already undone at {audit_entry.undone_at}.")

    sql, params = generate_inverse_mutation(audit_entry)
    driver = get_driver(config_from_connection(audit_entry.connection))
    try:
        res = driver.execute(sql, params, limit=10, timeout=20)

        # Mark original audit entry as undone
        audit_entry.undone_at = timezone.now()
        audit_entry.undone_by = user if getattr(user, "is_authenticated", False) else None
        audit_entry.save(update_fields=["undone_at", "undone_by"])

        # Record new UNDO entry
        record_audit(
            connection=audit_entry.connection,
            user=user,
            action=AuditLog.Action.UNDO,
            schema_name=audit_entry.schema_name,
            table_name=audit_entry.table_name,
            record_pk=audit_entry.record_pk,
            before_state=audit_entry.after_state,
            after_state=audit_entry.before_state,
            sql=sql,
            rows_affected=res.row_count,
            reversible=False,
            source=audit_entry.source,
        )

        return audit_entry
    finally:
        driver.close()


def create_change_request(
    connection: Connection,
    requester: Any,
    sql: str,
    action: str = "update",
    schema_name: str = "",
    table_name: str = "",
    params: list[Any] | None = None,
    staged_payload: list[dict[str, Any]] | None = None,
    title: str = "",
    description: str = "",
) -> ChangeRequest:
    """Run dry-run impact simulation and queue a ChangeRequest for peer review."""
    driver = get_driver(config_from_connection(connection))
    try:
        dry_run = driver.execute_dry_run(sql, params, timeout=20)
        impact_summary = {
            "rows_affected": dry_run.rows_affected,
            "sample_rows": dry_run.sample_rows,
            "duration_ms": dry_run.duration_ms,
            "warnings": dry_run.warnings,
        }
    except Exception as exc:
        logger.warning("Dry-run impact simulation failed during change request creation: %s", exc)
        impact_summary = {"rows_affected": 0, "sample_rows": [], "error": str(exc)}
    finally:
        driver.close()

    if not title:
        title = f"{action.capitalize()} on {schema_name}.{table_name}" if table_name else f"SQL Change ({action})"

    return ChangeRequest.objects.create(
        connection=connection,
        requester=requester,
        title=title,
        description=description,
        action=action,
        schema_name=schema_name,
        table_name=table_name,
        sql=sql,
        params=params,
        staged_payload=staged_payload,
        impact_summary=impact_summary,
        status=ChangeRequest.Status.PENDING,
    )


def approve_and_execute_request(change_request: ChangeRequest, reviewer: Any) -> dict[str, Any]:
    """Approve and execute a change request. Enforces requester != reviewer."""
    if change_request.status != ChangeRequest.Status.PENDING:
        raise ValidationError(f"Change request is already {change_request.status}.")

    # Enforce second-person approval (prevent self-approval on production)
    if reviewer.id == change_request.requester.id:
        raise PermissionDenied("Self-approval is not permitted on production connections. Another reviewer must approve.")

    driver = get_driver(config_from_connection(change_request.connection))
    try:
        res = driver.execute(change_request.sql, change_request.params, limit=10, timeout=30)

        change_request.status = ChangeRequest.Status.EXECUTED
        change_request.reviewer = reviewer
        change_request.reviewed_at = timezone.now()
        change_request.executed_at = timezone.now()
        change_request.save(update_fields=["status", "reviewer", "reviewed_at", "executed_at"])

        # Record to audit log
        record_audit(
            connection=change_request.connection,
            user=change_request.requester,
            action=change_request.action,
            schema_name=change_request.schema_name,
            table_name=change_request.table_name,
            sql=change_request.sql,
            rows_affected=res.row_count,
            reversible=False,
            source=AuditLog.Source.BROWSER,
        )

        return {
            "status": "executed",
            "rows_affected": res.row_count,
            "message": f"Change request #{change_request.id} approved and executed successfully.",
        }
    finally:
        driver.close()


def reject_change_request(change_request: ChangeRequest, reviewer: Any, comment: str = "") -> ChangeRequest:
    """Reject a pending change request."""
    if change_request.status != ChangeRequest.Status.PENDING:
        raise ValidationError(f"Change request is already {change_request.status}.")

    change_request.status = ChangeRequest.Status.REJECTED
    change_request.reviewer = reviewer
    change_request.reviewed_at = timezone.now()
    change_request.review_comment = comment.strip()
    change_request.save(update_fields=["status", "reviewer", "reviewed_at", "review_comment"])
    return change_request
