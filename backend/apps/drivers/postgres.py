from __future__ import annotations

import logging
import time
from typing import Any, Generator

import psycopg
from psycopg import sql as pg_sql
from psycopg.errors import OperationalError, QueryCanceled, ReadOnlySqlTransaction

from .base import (
    BaseDriver,
    ColumnMeta,
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
    ForeignKeyMeta,
    QueryResult,
    TableMeta,
    TestResult,
    generic_type_from_name,
    serialize_value,
)
from .pool import pool_manager, run_tracker
from .tunnel import SSHTunnel

logger = logging.getLogger(__name__)


class PostgresDriver(BaseDriver):
    """PostgreSQL driver built on psycopg v3 with pooling, timeouts, and cancellation."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._direct_tunnel: SSHTunnel | None = None

    def _get_connect_params(self) -> tuple[str, int]:
        """Resolve effective host and port, opening an SSH tunnel if needed."""
        if self.ssh_config.get("enabled"):
            if self._direct_tunnel is None:
                self._direct_tunnel = SSHTunnel(self.ssh_config, self.host, self.port)
                return self._direct_tunnel.start()
            return self._direct_tunnel.local_host, self._direct_tunnel.local_port or self.port
        return self.host, self.port

    def _open_direct_connection(self, timeout: int = 6) -> psycopg.Connection:
        """Open a single direct connection (used for testing or control commands)."""
        host, port = self._get_connect_params()
        try:
            conn = psycopg.connect(
                host=host,
                port=port,
                dbname=self.db_name,
                user=self.username,
                password=self.password or None,
                connect_timeout=timeout,
                sslmode=self.ssl_mode,
            )
            if self.read_only:
                conn.execute("SET default_transaction_read_only = on;")
            return conn
        except psycopg.Error as exc:
            msg = str(exc).strip()
            if "password authentication failed" in msg:
                raise DriverAuthenticationError(f"Authentication failed for user '{self.username}': {msg}", exc) from exc
            raise DriverConnectionError(f"Cannot connect to PostgreSQL at {self.host}:{self.port}/{self.db_name}: {msg}", exc) from exc

    def test_connection(self) -> TestResult:
        started = time.perf_counter()
        try:
            with self._open_direct_connection(timeout=6) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT version();")
                    row = cur.fetchone()
            latency = int((time.perf_counter() - started) * 1000)
            version = row[0] if row else ""
            return TestResult(ok=True, latency_ms=latency, server_version=version)
        except Exception as exc:
            msg = " ".join(str(exc).split())
            err_type = type(exc).__name__
            return TestResult(ok=False, error=f"{err_type}: {msg}"[:300])
        finally:
            self.close()

    def execute(
        self,
        sql: str,
        params: tuple | list | dict | None = None,
        limit: int = 1000,
        timeout: int = 30,
        run_id: str | None = None,
    ) -> QueryResult:
        started = time.perf_counter()
        conn_id = self.config.get("id")

        # Open connection
        conn = self._open_direct_connection(timeout=min(timeout, 10))
        backend_pid = conn.info.backend_pid

        if run_id:
            run_tracker.register(
                run_id=run_id,
                connection_id=conn_id,
                engine="postgres",
                backend_id=backend_pid,
                driver=self,
            )

        try:
            timeout_ms = max(int(timeout * 1000), 1000)
            conn.execute(f"SET statement_timeout = {timeout_ms};")

            with conn.cursor() as cur:
                cur.execute(sql, params)

                if cur.description is None:
                    # Non-SELECT statement (INSERT, UPDATE, DELETE, DDL)
                    conn.commit()
                    duration = int((time.perf_counter() - started) * 1000)
                    return QueryResult(
                        columns=[],
                        column_names=[],
                        rows=[],
                        row_count=cur.rowcount if cur.rowcount != -1 else 0,
                        duration_ms=duration,
                        truncated=False,
                    )

                # Query has a result set
                columns: list[ColumnMeta] = []
                col_names: list[str] = []
                for desc in cur.description:
                    name = desc.name
                    col_names.append(name)
                    # psycopg3 desc has type_code / display_size
                    columns.append(
                        ColumnMeta(
                            name=name,
                            data_type="text",
                            generic_type=generic_type_from_name(name),
                            nullable=True,
                        )
                    )

                # Fetch limit + 1 to detect truncation
                raw_rows = cur.fetchmany(limit + 1)
                truncated = len(raw_rows) > limit
                returned_rows = raw_rows[:limit]

                dict_rows: list[dict[str, Any]] = []
                for row in returned_rows:
                    row_dict = {}
                    for col_name, val in zip(col_names, row):
                        row_dict[col_name] = serialize_value(val)
                    dict_rows.append(row_dict)

                duration = int((time.perf_counter() - started) * 1000)
                return QueryResult(
                    columns=columns,
                    column_names=col_names,
                    rows=dict_rows,
                    row_count=len(dict_rows),
                    duration_ms=duration,
                    truncated=truncated,
                )

        except ReadOnlySqlTransaction as exc:
            conn.rollback()
            raise DriverReadOnlyError("Database is in read-only mode. Modifying operations are blocked.", exc) from exc
        except QueryCanceled as exc:
            conn.rollback()
            msg = str(exc).lower()
            if "statement timeout" in msg or "canceling statement due to statement timeout" in msg:
                raise DriverTimeoutError(f"Query timed out after {timeout} seconds.", exc) from exc
            raise DriverCancelledError("Query was cancelled by the user.", exc) from exc
        except OperationalError as exc:
            conn.rollback()
            raise DriverConnectionError(f"Connection error during query: {exc}", exc) from exc
        except psycopg.Error as exc:
            conn.rollback()
            raise DriverQueryError(f"Database error: {exc}", exc) from exc
        finally:
            if run_id:
                run_tracker.unregister(run_id)
            try:
                conn.close()
            except Exception:
                pass

    def stream_query(
        self,
        sql: str,
        params: tuple | list | dict | None = None,
        chunk_size: int = 1000,
        timeout: int = 60,
        max_rows: int | None = None,
    ) -> Generator[tuple[list[str], list[list[Any]]], None, None]:
        conn = self._open_direct_connection(timeout=min(timeout, 10))
        try:
            timeout_ms = max(int(timeout * 1000), 1000)
            conn.execute(f"SET statement_timeout = {timeout_ms};")

            with conn.cursor() as cur:
                cur.execute(sql, params)
                if cur.description is None:
                    return

                col_names = [desc.name for desc in cur.description]
                fetched_so_far = 0

                while True:
                    to_fetch = chunk_size
                    if max_rows is not None:
                        remaining = max_rows - fetched_so_far
                        if remaining <= 0:
                            break
                        to_fetch = min(chunk_size, remaining)

                    raw_rows = cur.fetchmany(to_fetch)
                    if not raw_rows:
                        break

                    fetched_so_far += len(raw_rows)
                    yield col_names, raw_rows

                    if max_rows is not None and fetched_so_far >= max_rows:
                        break

        except ReadOnlySqlTransaction as exc:
            conn.rollback()
            raise DriverReadOnlyError("Database is in read-only mode.", exc) from exc
        except QueryCanceled as exc:
            conn.rollback()
            msg = str(exc).lower()
            if "statement timeout" in msg or "canceling statement due to statement timeout" in msg:
                raise DriverTimeoutError(f"Query timed out after {timeout} seconds.", exc) from exc
            raise DriverCancelledError("Query was cancelled.", exc) from exc
        except OperationalError as exc:
            conn.rollback()
            raise DriverConnectionError(f"Connection error during query: {exc}", exc) from exc
        except psycopg.Error as exc:
            conn.rollback()
            raise DriverQueryError(f"Database error: {exc}", exc) from exc
        finally:
            try:
                conn.close()
            except Exception:
                pass
            self.close()

    def cancel(self, run_id: str) -> bool:
        """Cancel a running query by looking up its backend PID and issuing pg_cancel_backend."""
        run_info = run_tracker.get(run_id)
        if not run_info or not run_info.backend_id:
            return False

        pid = run_info.backend_id
        try:
            with self._open_direct_connection(timeout=5) as control_conn:
                with control_conn.cursor() as cur:
                    cur.execute("SELECT pg_cancel_backend(%s);", (pid,))
                    res = cur.fetchone()
                    return bool(res and res[0])
        except Exception as exc:
            logger.warning("Failed to cancel query %s (pid %s): %s", run_id, pid, exc)
            return False

    def list_schemas(self) -> list[str]:
        sql = """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND schema_name NOT LIKE 'pg_temp_%'
              AND schema_name NOT LIKE 'pg_toast_temp_%'
            ORDER BY schema_name;
        """
        with self._open_direct_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                return [row[0] for row in cur.fetchall()]

    def list_tables(self, schema: str) -> list[TableMeta]:
        sql = """
            SELECT
                t.table_name,
                t.table_type,
                COALESCE(c.reltuples, 0)::bigint AS row_estimate
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
            WHERE t.table_schema = %s
            ORDER BY t.table_name;
        """
        with self._open_direct_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (schema,))
                tables = []
                for name, t_type, estimate in cur.fetchall():
                    kind = "view" if "VIEW" in t_type else "table"
                    tables.append(
                        TableMeta(
                            name=name,
                            schema=schema,
                            type=kind,
                            row_count_estimate=max(int(estimate), 0) if estimate is not None else None,
                        )
                    )
                return tables

    def describe_table(self, schema: str, table: str) -> list[ColumnMeta]:
        col_sql = """
            SELECT
                column_name,
                data_type,
                udt_name,
                is_nullable,
                column_default,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position;
        """
        pk_sql = """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type = 'PRIMARY KEY';
        """
        fk_sql = """
            SELECT
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type = 'FOREIGN KEY';
        """

        with self._open_direct_connection() as conn:
            with conn.cursor() as cur:
                # 1. Columns
                cur.execute(col_sql, (schema, table))
                cols_data = cur.fetchall()

                # 2. PKs
                cur.execute(pk_sql, (schema, table))
                pks = {row[0] for row in cur.fetchall()}

                # 3. FKs
                cur.execute(fk_sql, (schema, table))
                fks: dict[str, ForeignKeyMeta] = {}
                for col_name, f_schema, f_table, f_col, c_name in cur.fetchall():
                    fks[col_name] = ForeignKeyMeta(
                        target_schema=f_schema,
                        target_table=f_table,
                        target_column=f_col,
                        constraint_name=c_name,
                    )

        result: list[ColumnMeta] = []
        for name, dtype, udt, is_null, default, _ord in cols_data:
            effective_type = udt or dtype
            result.append(
                ColumnMeta(
                    name=name,
                    data_type=effective_type,
                    generic_type=generic_type_from_name(effective_type),
                    nullable=(is_null.upper() == "YES"),
                    default=default,
                    is_primary_key=(name in pks),
                    foreign_key=fks.get(name),
                )
            )
        return result

    def close(self):
        if self._direct_tunnel is not None:
            self._direct_tunnel.stop()
            self._direct_tunnel = None
