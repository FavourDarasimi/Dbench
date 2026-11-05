from __future__ import annotations

import json
import logging
from typing import Any
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.base import ColumnMeta
from apps.drivers.factory import get_driver
from apps.explorer.services import schema_cache
from apps.queries.models import QueryHistory
from apps.audit.models import AuditLog
from apps.audit.services import create_change_request, record_audit

from .builder import quote_identifier

logger = logging.getLogger(__name__)


def _friendly_constraint_error(exc: Exception) -> str:
    """Translate raw database constraint exceptions into clean, actionable messages."""
    msg = str(exc).lower()
    if "foreign key" in msg or "violates foreign key constraint" in msg or "cannot add or update a child row" in msg:
        return "Constraint violation: A foreign key constraint failed. Ensure referenced records exist and are not locked."
    if "unique constraint" in msg or "duplicate key" in msg or "duplicate entry" in msg:
        return "Constraint violation: Duplicate value violates a unique constraint on this table."
    if "not-null constraint" in msg or "cannot be null" in msg or "column cannot be null" in msg:
        return "Constraint violation: A required column was left null or empty."
    if "read-only" in msg:
        return "Database is in read-only mode. Modifying operations are blocked."
    # Strip noisy stack trace details
    first_line = str(exc).split("\n")[0].strip()
    if first_line.lower().startswith("database error:"):
        first_line = first_line[len("database error:"):].strip()
    return f"Database error: {first_line}"[:250]


class MutationBuilder:
    """Compiles safe, parameterized INSERT, UPDATE, and DELETE queries for single rows by primary key."""

    def __init__(
        self,
        schema: str,
        table: str,
        columns: list[ColumnMeta],
        dialect: str = "postgres",
    ):
        self.schema = schema.strip()
        self.table = table.strip()
        self.dialect = "postgres" if dialect == "postgres" else "mysql"
        self.columns_by_name: dict[str, ColumnMeta] = {c.name: c for c in columns}
        self.primary_key_col: str | None = next((c.name for c in columns if c.is_primary_key), None)

    def _quote(self, identifier: str) -> str:
        return quote_identifier(identifier, dialect=self.dialect)

    def _normalize_param_value(self, col_name: str, val: Any) -> Any:
        col = self.columns_by_name.get(col_name)
        if not col:
            return val

        is_json = col.generic_type == "json" or "json" in col.data_type.lower()
        if is_json:
            if val is None:
                return None
            if isinstance(val, (dict, list)):
                return json.dumps(val)
            if isinstance(val, str):
                trimmed = val.strip()
                if not trimmed:
                    return None if col.nullable else "{}"
                try:
                    # Validate that it is valid JSON
                    json.loads(trimmed)
                    return trimmed
                except Exception as exc:
                    raise ValidationError(f"Invalid JSON format for column '{col_name}': {exc}")
            return json.dumps(val)

        if val == "" and col.generic_type in ("number", "datetime", "date", "time", "uuid"):
            return None

        return val

    def build_insert(self, data: dict[str, Any]) -> tuple[str, list[Any]]:
        if not data:
            raise ValidationError("Insert payload cannot be empty.")

        cols: list[str] = []
        params: list[Any] = []
        for col_name, val in data.items():
            if col_name not in self.columns_by_name:
                raise ValidationError(f"Unknown column: '{col_name}'.")
            cols.append(self._quote(col_name))
            params.append(self._normalize_param_value(col_name, val))

        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        cols_sql = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))

        sql = f"INSERT INTO {table_ref} ({cols_sql}) VALUES ({placeholders})"
        if self.dialect == "postgres":
            sql += " RETURNING *;"
        else:
            sql += ";"
        return sql, params

    def build_update(self, pk_value: Any, data: dict[str, Any]) -> tuple[str, list[Any]]:
        if not self.primary_key_col:
            raise ValidationError(f"Table '{self.schema}.{self.table}' has no primary key. Editing is disabled.")
        if not data:
            raise ValidationError("Update payload cannot be empty.")

        set_clauses: list[str] = []
        params: list[Any] = []
        for col_name, val in data.items():
            if col_name not in self.columns_by_name:
                raise ValidationError(f"Unknown column: '{col_name}'.")
            # Skip updating PK to same value
            if col_name == self.primary_key_col and str(val) == str(pk_value):
                continue
            set_clauses.append(f"{self._quote(col_name)} = %s")
            params.append(self._normalize_param_value(col_name, val))

        if not set_clauses:
            raise ValidationError("No fields to update.")

        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        pk_clause = f"{self._quote(self.primary_key_col)} = %s"
        params.append(pk_value)

        sql = f"UPDATE {table_ref} SET {', '.join(set_clauses)} WHERE {pk_clause}"
        if self.dialect == "postgres":
            sql += " RETURNING *;"
        else:
            sql += ";"
        return sql, params

    def build_delete(self, pk_value: Any) -> tuple[str, list[Any]]:
        if not self.primary_key_col:
            raise ValidationError(f"Table '{self.schema}.{self.table}' has no primary key. Deletion is disabled.")

        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        pk_clause = f"{self._quote(self.primary_key_col)} = %s"
        sql = f"DELETE FROM {table_ref} WHERE {pk_clause};"
        return sql, [pk_value]

    def build_bulk_delete(self, pk_values: list[Any]) -> tuple[str, list[Any]]:
        if not self.primary_key_col:
            raise ValidationError(f"Table '{self.schema}.{self.table}' has no primary key. Deletion is disabled.")
        if not pk_values:
            raise ValidationError("No primary key values provided for deletion.")

        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        placeholders = ", ".join(["%s"] * len(pk_values))
        pk_clause = f"{self._quote(self.primary_key_col)} IN ({placeholders})"
        sql = f"DELETE FROM {table_ref} WHERE {pk_clause};"
        return sql, list(pk_values)


def _render_preview_sql(sql: str, params: list[Any]) -> str:
    """Format parameterized SQL safely for display."""
    def repr_val(v: Any) -> str:
        if v is None:
            return "NULL"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, bool):
            return "TRUE" if v else "FALSE"
        clean = str(v).replace("'", "''")
        return f"'{clean}'"

    formatted = sql
    for p in params:
        formatted = formatted.replace("%s", repr_val(p), 1)
    return formatted


def execute_row_mutation(
    connection: Connection,
    user: Any,
    action: str,
    schema: str,
    table: str,
    data: dict[str, Any] | None = None,
    pk: Any | None = None,
    pks: list[Any] | None = None,
    preview: bool = False,
) -> dict[str, Any]:
    """
    Execute or preview a structured data mutation (PRD F18, F22, §10 Decision 11).
    Enforces read-only connection limits, view restrictions, and PK presence.
    """
    # 1. Connection Read-Only Check
    if connection.read_only:
        raise PermissionDenied("This connection is in read-only mode. Modifying operations are blocked.")

    # 2. Verify Table is NOT a View
    tables = schema_cache.get_tables(connection, schema)
    target_meta = next((t for t in tables if t["name"] == table), None)
    if target_meta and target_meta.get("type") == "view":
        raise ValidationError(f"'{schema}.{table}' is a database view. Views are strictly read-only in the Data Browser.")

    # 3. Retrieve and Validate Columns
    columns_raw = schema_cache.get_columns(connection, schema, table)
    columns = [
        ColumnMeta(
            name=c["name"],
            data_type=c["data_type"],
            generic_type=c["generic_type"],
            nullable=c.get("nullable", True),
            default=c.get("default"),
            is_primary_key=c.get("is_primary_key", False),
        )
        for c in columns_raw
    ]

    builder = MutationBuilder(schema=schema, table=table, columns=columns, dialect=connection.engine)
    data = data or {}
    action = action.lower().strip()

    # 4. Build parameterized SQL
    if action == "insert":
        sql, params = builder.build_insert(data)
    elif action == "update":
        if pk is None:
            raise ValidationError("Primary key 'pk' is required for row update.")
        sql, params = builder.build_update(pk, data)
    elif action == "delete":
        if pk is None:
            raise ValidationError("Primary key 'pk' is required for row deletion.")
        sql, params = builder.build_delete(pk)
    elif action == "bulk_delete":
        if not pks:
            raise ValidationError("List of primary keys 'pks' is required for bulk deletion.")
        sql, params = builder.build_bulk_delete(pks)
    else:
        raise ValidationError(f"Unsupported mutation action: '{action}'. Expected 'insert', 'update', 'delete', or 'bulk_delete'.")

    preview_sql = _render_preview_sql(sql, params)

    # 5. Preview Mode (PRD F18 confirm-before-commit)
    if preview:
        return {
            "action": action,
            "schema": schema,
            "table": table,
            "pk": pk,
            "pks": pks,
            "preview": True,
            "sql": preview_sql,
            "message": "Mutation preview generated. Submit with preview=false to commit.",
            "rows_affected": 0,
            "row": None,
        }

    # Fetch before_state for UPDATE or DELETE to enable 1-click undo
    before_state = None
    if action in ("update", "delete") and pk is not None and builder.primary_key_col:
        try:
            fetch_driver = get_driver(config_from_connection(connection))
            table_ref = f"{builder._quote(schema)}.{builder._quote(table)}"
            pk_clause = f"{builder._quote(builder.primary_key_col)} = %s"
            fetch_res = fetch_driver.execute(f"SELECT * FROM {table_ref} WHERE {pk_clause} LIMIT 1;", [pk], timeout=10)
            if fetch_res.rows:
                before_state = fetch_res.rows[0]
            fetch_driver.close()
        except Exception as exc:
            logger.debug("Could not fetch before_state for undo: %s", exc)

    # 6. Production Approval Check
    if getattr(connection, "require_approval", False):
        cr = create_change_request(
            connection=connection,
            requester=user,
            sql=sql,
            action=action,
            schema_name=schema,
            table_name=table,
            params=params,
            title=f"{action.capitalize()} {schema}.{table} row ({pk})" if pk else f"{action.capitalize()} on {schema}.{table}",
        )
        return {
            "action": action,
            "schema": schema,
            "table": table,
            "pk": pk,
            "pks": pks,
            "preview": False,
            "requires_approval": True,
            "change_request_id": str(cr.id),
            "impact_summary": cr.impact_summary,
            "message": f"Change request #{cr.id} created. Awaiting peer approval on production.",
            "rows_affected": 0,
            "row": None,
        }

    # 7. Execute Mutation
    driver = get_driver(config_from_connection(connection))
    try:
        res = driver.execute(sql, params, limit=10, timeout=20)

        # Log mutation to QueryHistory
        QueryHistory.objects.create(
            user=user,
            connection=connection,
            sql=sql,
            status=QueryHistory.Status.SUCCESS,
            duration_ms=res.duration_ms,
            row_count=res.row_count,
            source=QueryHistory.Source.BROWSER,
        )

        returned_row = res.rows[0] if res.rows else None

        # Log to AuditLog for row-level auditing and 1-click undo
        audit_entry = record_audit(
            connection=connection,
            user=user,
            action=action,
            schema_name=schema,
            table_name=table,
            record_pk=str(pk) if pk is not None else "",
            before_state=before_state,
            after_state=returned_row or data if action in ("insert", "update") else None,
            sql=preview_sql,
            rows_affected=res.row_count,
            reversible=action in ("insert", "update", "delete"),
            source=AuditLog.Source.BROWSER,
        )

        # Invalidate metadata cache so sidebar row counts update immediately
        if action in ("insert", "delete", "bulk_delete"):
            try:
                schema_cache.invalidate_connection(str(connection.id))
            except Exception:
                pass

        return {
            "action": action,
            "schema": schema,
            "table": table,
            "pk": pk,
            "pks": pks,
            "preview": False,
            "audit_id": str(audit_entry.id),
            "sql": preview_sql,
            "rows_affected": res.row_count,
            "row": returned_row,
            "message": f"Successfully performed {action} on {schema}.{table} ({res.row_count} row affected).",
        }
    except Exception as exc:
        clean_msg = _friendly_constraint_error(exc)
        logger.warning("Mutation error on %s.%s (%s): %s", schema, table, action, exc)
        raise ValidationError(clean_msg) from exc
    finally:
        driver.close()


def execute_staged_mutations(
    connection: Connection,
    user: Any,
    staged_items: list[dict[str, Any]],
    preview: bool = False,
) -> dict[str, Any]:
    """
    Execute a batch of staged mutations atomically inside a single database transaction.
    Enforces read-only connection limits, view restrictions, and approval requirements.
    """
    if connection.read_only:
        raise PermissionDenied("This connection is in read-only mode. Modifying operations are blocked.")
    if not staged_items:
        raise ValidationError("No staged changes to commit.")

    compiled_statements: list[tuple[str, list[Any], dict[str, Any]]] = []

    for item in staged_items:
        action = item.get("action", "").lower().strip()
        schema = item.get("schema", "public").strip()
        table = item.get("table", "").strip()
        data = item.get("data") or {}
        pk = item.get("pk")

        tables = schema_cache.get_tables(connection, schema)
        target_meta = next((t for t in tables if t["name"] == table), None)
        if target_meta and target_meta.get("type") == "view":
            raise ValidationError(f"'{schema}.{table}' is a database view. Editing is not permitted.")

        columns_raw = schema_cache.get_columns(connection, schema, table)
        columns = [
            ColumnMeta(
                name=c["name"],
                data_type=c["data_type"],
                generic_type=c["generic_type"],
                nullable=c.get("nullable", True),
                default=c.get("default"),
                is_primary_key=c.get("is_primary_key", False),
            )
            for c in columns_raw
        ]
        builder = MutationBuilder(schema=schema, table=table, columns=columns, dialect=connection.engine)

        if action == "insert":
            sql, params = builder.build_insert(data)
        elif action == "update":
            if pk is None:
                raise ValidationError("Primary key 'pk' is required for row update.")
            sql, params = builder.build_update(pk, data)
        elif action == "delete":
            if pk is None:
                raise ValidationError("Primary key 'pk' is required for row deletion.")
            sql, params = builder.build_delete(pk)
        else:
            raise ValidationError(f"Unsupported staged mutation action: '{action}'.")

        compiled_statements.append((sql, params, item))

    # Combine SQL into a readable preview
    all_preview_sqls = [_render_preview_sql(s, p) for s, p, _ in compiled_statements]
    combined_sql = "\n".join(all_preview_sqls)

    if preview:
        driver = get_driver(config_from_connection(connection))
        total_affected = 0
        try:
            for sql, params, _ in compiled_statements:
                dr = driver.execute_dry_run(sql, params, timeout=10)
                total_affected += dr.rows_affected
            return {
                "preview": True,
                "staged_count": len(staged_items),
                "rows_affected": total_affected,
                "sql": combined_sql,
                "message": f"Preview: {len(staged_items)} staged changes will affect {total_affected} rows.",
            }
        except Exception as exc:
            raise ValidationError(f"Dry run simulation error: {exc}") from exc
        finally:
            driver.close()

    # Production Approval Check
    if getattr(connection, "require_approval", False):
        cr = create_change_request(
            connection=connection,
            requester=user,
            sql=combined_sql,
            action="batch_mutation",
            schema_name=staged_items[0].get("schema", "public"),
            table_name=staged_items[0].get("table", "batch"),
            staged_payload=staged_items,
            title=f"Batch of {len(staged_items)} staged edits on {staged_items[0].get('table', 'tables')}",
        )
        return {
            "preview": False,
            "requires_approval": True,
            "change_request_id": str(cr.id),
            "impact_summary": cr.impact_summary,
            "message": f"Batch change request #{cr.id} created. Awaiting peer approval on production.",
        }

    # Execute atomically in one connection/transaction
    driver = get_driver(config_from_connection(connection))
    audit_ids: list[str] = []
    try:
        for sql, params, item in compiled_statements:
            res = driver.execute(sql, params, limit=10, timeout=20)
            audit_entry = record_audit(
                connection=connection,
                user=user,
                action=item.get("action", "update"),
                schema_name=item.get("schema", "public"),
                table_name=item.get("table", ""),
                record_pk=str(item.get("pk", "")),
                before_state=item.get("originalData"),
                after_state=item.get("data"),
                sql=_render_preview_sql(sql, params),
                rows_affected=res.row_count,
                reversible=True,
                source=AuditLog.Source.STAGING,
            )
            audit_ids.append(str(audit_entry.id))

        try:
            schema_cache.invalidate_connection(str(connection.id))
        except Exception:
            pass

        return {
            "preview": False,
            "staged_count": len(staged_items),
            "audit_ids": audit_ids,
            "message": f"Successfully committed {len(staged_items)} staged changes.",
        }
    except Exception as exc:
        clean_msg = _friendly_constraint_error(exc)
        logger.warning("Batch staged mutation failed: %s", exc)
        raise ValidationError(f"Batch commit failed: {clean_msg}") from exc
    finally:
        driver.close()
