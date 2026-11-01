from __future__ import annotations

import logging
from typing import Any
from rest_framework.exceptions import NotFound, ValidationError

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.base import ColumnMeta, QueryResult
from apps.drivers.factory import get_driver
from apps.explorer.services import schema_cache
from apps.queries.models import QueryHistory

from .builder import BrowseQueryBuilder, quote_identifier

logger = logging.getLogger(__name__)


def get_table_row_count(
    connection: Connection,
    schema: str,
    table: str,
    exact: bool = False,
    builder: BrowseQueryBuilder | None = None,
) -> int:
    """Retrieve row count (fast estimate by default, exact on demand per PRD F20)."""
    driver = get_driver(config_from_connection(connection))
    try:
        # If active filters/search exist, we must calculate count for that filtered set
        if builder and (builder.filters or builder.search):
            count_sql, count_params = builder.build_count_query()
            res = driver.execute(count_sql, count_params, limit=1, timeout=15)
            if res.rows:
                return int(next(iter(res.rows[0].values())))
            return 0

        # Exact count requested
        if exact:
            q_schema = quote_identifier(schema, connection.engine)
            q_table = quote_identifier(table, connection.engine)
            count_sql = f"SELECT COUNT(*) FROM {q_schema}.{q_table};"
            res = driver.execute(count_sql, limit=1, timeout=20)
            if res.rows:
                return int(next(iter(res.rows[0].values())))
            return 0

        # Fast engine estimate
        if connection.engine == Connection.Engine.POSTGRES:
            est_sql = """
                SELECT COALESCE(c.reltuples, 0)::bigint
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = %s AND c.relname = %s;
            """
            res = driver.execute(est_sql, (schema, table), limit=1, timeout=5)
            if res.rows:
                val = next(iter(res.rows[0].values()))
                if val is not None and int(val) >= 0:
                    return int(val)
        else:
            est_sql = """
                SELECT table_rows
                FROM information_schema.tables
                WHERE table_schema = %s AND table_name = %s;
            """
            res = driver.execute(est_sql, (schema, table), limit=1, timeout=5)
            if res.rows:
                val = next(iter(res.rows[0].values()))
                if val is not None and int(val) >= 0:
                    return int(val)

        # Fallback to exact count if estimate is unavailable
        q_schema = quote_identifier(schema, connection.engine)
        q_table = quote_identifier(table, connection.engine)
        count_sql = f"SELECT COUNT(*) FROM {q_schema}.{q_table};"
        res = driver.execute(count_sql, limit=1, timeout=20)
        return int(next(iter(res.rows[0].values()))) if res.rows else 0
    finally:
        driver.close()


def get_row_detail_with_related(
    connection: Connection,
    schema: str,
    table: str,
    pk_value: Any,
) -> dict[str, Any]:
    """Fetch single row by PK and count referencing rows in related tables (PRD F17)."""
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

    pk_col = next((c.name for c in columns if c.is_primary_key), None)
    if not pk_col:
        raise ValidationError(f"Table '{schema}.{table}' does not have a primary key.")

    driver = get_driver(config_from_connection(connection))
    try:
        # 1. Fetch the row itself
        q_schema = quote_identifier(schema, connection.engine)
        q_table = quote_identifier(table, connection.engine)
        q_pk = quote_identifier(pk_col, connection.engine)
        select_sql = f"SELECT * FROM {q_schema}.{q_table} WHERE {q_pk} = %s LIMIT 1;"

        res = driver.execute(select_sql, (pk_value,), limit=1, timeout=10)
        if not res.rows:
            raise NotFound(f"Row with primary key {pk_col}={pk_value} not found.")

        row_data = res.rows[0]

        # 2. Introspect foreign keys referencing this table
        related_counts: list[dict[str, Any]] = []
        if connection.engine == Connection.Engine.POSTGRES:
            rel_sql = """
                SELECT
                    tc.table_schema,
                    tc.table_name,
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                 AND ccu.table_schema = tc.table_schema
                WHERE ccu.table_schema = %s
                  AND ccu.table_name = %s
                  AND tc.constraint_type = 'FOREIGN KEY';
            """
        else:
            rel_sql = """
                SELECT
                    table_schema,
                    table_name,
                    column_name
                FROM information_schema.key_column_usage
                WHERE referenced_table_schema = %s
                  AND referenced_table_name = %s;
            """

        rel_res = driver.execute(rel_sql, (schema, table), limit=50, timeout=10)
        for rel_row in rel_res.rows:
            ref_schema = rel_row.get("table_schema")
            ref_table = rel_row.get("table_name")
            ref_col = rel_row.get("column_name")
            if not ref_schema or not ref_table or not ref_col:
                continue

            try:
                q_rs = quote_identifier(ref_schema, connection.engine)
                q_rt = quote_identifier(ref_table, connection.engine)
                q_rc = quote_identifier(ref_col, connection.engine)
                count_query = f"SELECT COUNT(*) FROM {q_rs}.{q_rt} WHERE {q_rc} = %s;"
                c_res = driver.execute(count_query, (pk_value,), limit=1, timeout=5)
                count_val = int(next(iter(c_res.rows[0].values()))) if c_res.rows else 0
                related_counts.append({
                    "schema": ref_schema,
                    "table": ref_table,
                    "column": ref_col,
                    "count": count_val,
                })
            except Exception as exc:
                logger.debug("Failed counting related rows in %s.%s: %s", ref_schema, ref_table, exc)

        return {
            "row": row_data,
            "pk_column": pk_col,
            "pk_value": pk_value,
            "columns": [c.to_dict() for c in columns],
            "related": related_counts,
        }
    finally:
        driver.close()


def execute_browse(
    connection: Connection,
    user: Any,
    builder: BrowseQueryBuilder,
) -> dict[str, Any]:
    """Execute browse query, log to QueryHistory, and return paginated payload."""
    sql, params = builder.build()
    driver = get_driver(config_from_connection(connection))

    try:
        result = driver.execute(
            sql=sql,
            params=params,
            limit=builder.page_size,
            timeout=30,
        )

        # Log browse query to QueryHistory (PRD §10)
        QueryHistory.objects.create(
            user=user,
            connection=connection,
            sql=sql,
            status=QueryHistory.Status.SUCCESS,
            duration_ms=result.duration_ms,
            row_count=result.row_count,
            source=QueryHistory.Source.BROWSER,
        )

        # Determine total estimate
        total_estimate = get_table_row_count(
            connection,
            schema=builder.schema,
            table=builder.table,
            exact=False,
            builder=builder,
        )

        has_more = len(result.rows) == builder.page_size

        return {
            "schema": builder.schema,
            "table": builder.table,
            "columns": [c.to_dict() for c in builder.columns_by_name.values()],
            "rows": result.rows,
            "page": builder.page,
            "page_size": builder.page_size,
            "row_count": result.row_count,
            "total_rows": total_estimate,
            "duration_ms": result.duration_ms,
            "has_more": has_more,
        }
    finally:
        driver.close()
