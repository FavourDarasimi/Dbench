from __future__ import annotations

import logging
import time
from typing import Any, Generator

import pymysql
import pymysql.cursors

from .base import (
    BaseDriver,
    ColumnMeta,
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
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
from .pool import run_tracker
from .tunnel import SSHTunnel

logger = logging.getLogger(__name__)


class MySQLDriver(BaseDriver):
    """MySQL driver built on PyMySQL with timeouts, cancellation, and read-only mode."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._direct_tunnel: SSHTunnel | None = None

    def _get_connect_params(self) -> tuple[str, int]:
        if self.ssh_config.get("enabled"):
            if self._direct_tunnel is None:
                self._direct_tunnel = SSHTunnel(self.ssh_config, self.host, self.port)
                return self._direct_tunnel.start()
            return self._direct_tunnel.local_host, self._direct_tunnel.local_port or self.port
        return self.host, self.port

    def _open_direct_connection(self, timeout: int = 6) -> pymysql.connections.Connection:
        host, port = self._get_connect_params()
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user=self.username,
                password=self.password or None,
                database=self.db_name,
                connect_timeout=timeout,
                ssl_disabled=(self.ssl_mode == "disable"),
                cursorclass=pymysql.cursors.Cursor,
                autocommit=False,
            )
            if self.read_only:
                try:
                    with conn.cursor() as cur:
                        cur.execute("SET SESSION transaction_read_only = ON;")
                except Exception:
                    with conn.cursor() as cur:
                        cur.execute("SET TRANSACTION READ ONLY;")
            return conn
        except pymysql.MySQLError as exc:
            msg = str(exc).strip()
            if "Access denied for user" in msg:
                raise DriverAuthenticationError(f"MySQL access denied for user '{self.username}': {msg}", exc) from exc
            raise DriverConnectionError(f"Cannot connect to MySQL at {self.host}:{self.port}/{self.db_name}: {msg}", exc) from exc

    def test_connection(self) -> TestResult:
        started = time.perf_counter()
        conn = None
        try:
            conn = self._open_direct_connection(timeout=6)
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
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
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
        conn = self._open_direct_connection(timeout=min(timeout, 10))
        thread_id = conn.thread_id()

        if run_id:
            run_tracker.register(
                run_id=run_id,
                connection_id=conn_id,
                engine="mysql",
                backend_id=thread_id,
                driver=self,
            )

        try:
            timeout_ms = max(int(timeout * 1000), 1000)
            with conn.cursor() as cur:
                try:
                    cur.execute(f"SET max_execution_time = {timeout_ms};")
                except Exception:
                    pass  # Non-SELECT statements or older MySQL may ignore max_execution_time

                cur.execute(sql, params)

                if cur.description is None:
                    if self.read_only:
                        conn.rollback()
                        raise DriverReadOnlyError("Connection is in read-only mode. Modifying operations are blocked.")
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

                columns: list[ColumnMeta] = []
                col_names: list[str] = []
                for desc in cur.description:
                    name = desc[0]
                    col_names.append(name)
                    columns.append(
                        ColumnMeta(
                            name=name,
                            data_type="text",
                            generic_type=generic_type_from_name(name),
                            nullable=True,
                        )
                    )

                raw_rows = cur.fetchmany(limit + 1)
                truncated = len(raw_rows) > limit
                returned_rows = raw_rows[:limit]

                dict_rows: list[dict[str, Any]] = []
                for row in returned_rows:
                    row_dict = {}
                    for col_name, val in zip(col_names, row):
                        row_dict[col_name] = serialize_value(val)
                    dict_rows.append(row_dict)

                if not self.read_only:
                    conn.commit()

                duration = int((time.perf_counter() - started) * 1000)
                return QueryResult(
                    columns=columns,
                    column_names=col_names,
                    rows=dict_rows,
                    row_count=len(dict_rows),
                    duration_ms=duration,
                    truncated=truncated,
                )

        except pymysql.err.OperationalError as exc:
            conn.rollback()
            code, msg = exc.args if len(exc.args) >= 2 else (0, str(exc))
            # 1792 = Cannot execute statement in a READ ONLY transaction
            # 1290 = The MySQL server is running with the --read-only option so it cannot execute this statement
            if code in (1792, 1290) or "read only" in str(msg).lower():
                raise DriverReadOnlyError("Database is in read-only mode. Modifying operations are blocked.", exc) from exc
            if code in (1317, 3024) or "query execution was interrupted" in str(msg).lower():
                if code == 3024 or "max_execution_time" in str(msg).lower() or "max_statement_time" in str(msg).lower():
                    raise DriverTimeoutError(f"Query timed out after {timeout} seconds.", exc) from exc
                raise DriverCancelledError("Query was cancelled by the user.", exc) from exc
            raise DriverQueryError(f"MySQL error: {msg}", exc) from exc
        except pymysql.MySQLError as exc:
            conn.rollback()
            raise DriverQueryError(f"MySQL error: {exc}", exc) from exc
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
            if timeout > 0:
                timeout_ms = int(timeout * 1000)
                with conn.cursor() as cur:
                    cur.execute(f"SET SESSION max_execution_time = {timeout_ms};")

            # Use SSCursor (streaming cursor) to avoid loading all rows in memory
            with conn.cursor(pymysql.cursors.SSCursor) as cur:
                cur.execute(sql, params)
                if cur.description is None:
                    return

                col_names = [desc[0] for desc in cur.description]
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

        except pymysql.err.OperationalError as exc:
            conn.rollback()
            code, msg = exc.args if len(exc.args) >= 2 else (0, str(exc))
            if code in (1792, 1290) or "read only" in str(msg).lower():
                raise DriverReadOnlyError("Database is in read-only mode.", exc) from exc
            if code in (1317, 3024) or "query execution was interrupted" in str(msg).lower():
                if code == 3024 or "max_execution_time" in str(msg).lower() or "max_statement_time" in str(msg).lower():
                    raise DriverTimeoutError(f"Query timed out after {timeout} seconds.", exc) from exc
                raise DriverCancelledError("Query was cancelled.", exc) from exc
            raise DriverQueryError(f"MySQL error: {msg}", exc) from exc
        except pymysql.MySQLError as exc:
            conn.rollback()
            raise DriverQueryError(f"MySQL error: {exc}", exc) from exc
        finally:
            try:
                conn.close()
            except Exception:
                pass
            self.close()

    def cancel(self, run_id: str) -> bool:
        """Cancel a running query by looking up its thread ID and issuing KILL QUERY."""
        run_info = run_tracker.get(run_id)
        if not run_info or not run_info.backend_id:
            return False

        thread_id = run_info.backend_id
        control_conn = None
        try:
            control_conn = self._open_direct_connection(timeout=5)
            with control_conn.cursor() as cur:
                cur.execute(f"KILL QUERY {thread_id};")
                return True
        except Exception as exc:
            logger.warning("Failed to cancel MySQL query %s (thread %s): %s", run_id, thread_id, exc)
            return False
        finally:
            if control_conn is not None:
                try:
                    control_conn.close()
                except Exception:
                    pass

    def list_schemas(self) -> list[str]:
        sql = """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            ORDER BY schema_name;
        """
        conn = self._open_direct_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                return [row[0] for row in cur.fetchall()]
        finally:
            conn.close()

    def list_tables(self, schema: str) -> list[TableMeta]:
        sql = """
            SELECT table_name, table_type, table_rows
            FROM information_schema.tables
            WHERE table_schema = %s
            ORDER BY table_name;
        """
        conn = self._open_direct_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (schema,))
                tables = []
                for name, t_type, rows in cur.fetchall():
                    kind = "view" if "VIEW" in (t_type or "") else "table"
                    tables.append(
                        TableMeta(
                            name=name,
                            schema=schema,
                            type=kind,
                            row_count_estimate=int(rows) if rows is not None else None,
                        )
                    )
                return tables
        finally:
            conn.close()

    def describe_table(self, schema: str, table: str) -> list[ColumnMeta]:
        col_sql = """
            SELECT column_name, data_type, is_nullable, column_default, column_key
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position;
        """
        fk_sql = """
            SELECT column_name, referenced_table_schema, referenced_table_name, referenced_column_name, constraint_name
            FROM information_schema.key_column_usage
            WHERE table_schema = %s AND table_name = %s AND referenced_table_name IS NOT NULL;
        """
        conn = self._open_direct_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(col_sql, (schema, table))
                cols_data = cur.fetchall()

                cur.execute(fk_sql, (schema, table))
                fks = {}
                for c_name, r_schema, r_table, r_col, constr in cur.fetchall():
                    fks[c_name] = ForeignKeyMeta(
                        target_schema=r_schema,
                        target_table=r_table,
                        target_column=r_col,
                        constraint_name=constr,
                    )
            result = []
            for name, dtype, is_null, default, key in cols_data:
                result.append(
                    ColumnMeta(
                        name=name,
                        data_type=dtype,
                        generic_type=generic_type_from_name(dtype),
                        nullable=(is_null.upper() == "YES"),
                        default=default,
                        is_primary_key=(key.upper() == "PRI"),
                        foreign_key=fks.get(name),
                    )
                )
            return result
        finally:
            conn.close()

    def describe_schema_erd(self, schema: str) -> dict[str, Any]:
        """Batch-optimized ERD schema introspection for MySQL."""
        tables_meta = self.list_tables(schema)

        all_cols_sql = """
            SELECT table_name, column_name, data_type, is_nullable, column_default, column_key
            FROM information_schema.columns
            WHERE table_schema = %s
            ORDER BY table_name, ordinal_position;
        """
        all_fks_sql = """
            SELECT table_name, column_name, referenced_table_schema, referenced_table_name, referenced_column_name, constraint_name
            FROM information_schema.key_column_usage
            WHERE table_schema = %s AND referenced_table_name IS NOT NULL;
        """

        conn = self._open_direct_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(all_cols_sql, (schema,))
                cols_rows = cur.fetchall()

                cur.execute(all_fks_sql, (schema,))
                fks_by_table: dict[str, dict[str, ForeignKeyMeta]] = {}
                relations: list[dict[str, Any]] = []
                for s_table, s_col, r_schema, r_table, r_col, constr in cur.fetchall():
                    fk_meta = ForeignKeyMeta(
                        target_schema=r_schema,
                        target_table=r_table,
                        target_column=r_col,
                        constraint_name=constr,
                    )
                    fks_by_table.setdefault(s_table, {})[s_col] = fk_meta
                    relations.append({
                        "id": f"rel-{s_table}-{s_col}-{r_table}-{r_col}",
                        "source_schema": schema,
                        "source_table": s_table,
                        "source_column": s_col,
                        "target_schema": r_schema,
                        "target_table": r_table,
                        "target_column": r_col,
                        "constraint_name": constr,
                    })
        finally:
            conn.close()

        tables_dict: dict[str, list[dict[str, Any]]] = {}
        for t_name, c_name, dtype, is_null, default, key in cols_rows:
            col_meta = ColumnMeta(
                name=c_name,
                data_type=dtype,
                generic_type=generic_type_from_name(dtype),
                nullable=(is_null.upper() == "YES"),
                default=default,
                is_primary_key=(key.upper() == "PRI"),
                foreign_key=fks_by_table.get(t_name, {}).get(c_name),
            )
            col_dict = col_meta.to_dict()
            col_dict["is_unique"] = (key.upper() == "UNI")
            tables_dict.setdefault(t_name, []).append(col_dict)

        tables_result = []
        for t in tables_meta:
            tables_result.append({
                "name": t.name,
                "schema": schema,
                "type": t.type,
                "columns": tables_dict.get(t.name, []),
            })

        return {
            "schema": schema,
            "tables": tables_result,
            "relations": relations,
        }

    def close(self):
        if self._direct_tunnel is not None:
            self._direct_tunnel.stop()
            self._direct_tunnel = None
