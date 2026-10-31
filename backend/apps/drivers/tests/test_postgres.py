from types import SimpleNamespace
from unittest.mock import MagicMock

import psycopg
from psycopg.errors import OperationalError, QueryCanceled, ReadOnlySqlTransaction
import pytest

from apps.drivers.base import (
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
)
from apps.drivers.postgres import PostgresDriver


class FakeDescription:
    def __init__(self, name):
        self.name = name


class FakeCursor:
    def __init__(self, rows=None, description=None, rowcount=-1):
        self._rows = rows or []
        self.description = description
        self.rowcount = rowcount
        self.executed_queries = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, params=None):
        self.executed_queries.append((query, params))

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)

    def fetchmany(self, size):
        return list(self._rows[:size])


class FakeConnection:
    def __init__(self, cursor_obj=None, pid=12345):
        self._cursor = cursor_obj or FakeCursor()
        self.info = SimpleNamespace(backend_pid=pid)
        self.executed_statements = []
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return self._cursor

    def execute(self, statement, params=None):
        self.executed_statements.append((statement, params))

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


CONFIG = {
    "engine": "postgres",
    "host": "localhost",
    "port": 5432,
    "db_name": "testdb",
    "username": "postgres",
    "password": "secret",
    "ssl_mode": "prefer",
    "read_only": False,
}


def test_postgres_test_connection_success(monkeypatch):
    cursor = FakeCursor(rows=[("PostgreSQL 16.4 on x86_64",)])
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    result = driver.test_connection()
    assert result.ok is True
    assert "PostgreSQL 16.4" in result.server_version
    assert isinstance(result.latency_ms, int)


def test_postgres_test_connection_auth_failure(monkeypatch):
    def fake_connect(**kwargs):
        raise psycopg.Error('password authentication failed for user "postgres"')

    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", fake_connect)

    driver = PostgresDriver(CONFIG)
    result = driver.test_connection()
    assert result.ok is False
    assert "password authentication failed" in result.error


def test_postgres_execute_select_with_limit_and_truncation(monkeypatch):
    # 4 rows, but limit=2 -> should return 2 rows and truncated=True
    rows = [(1, "Alice"), (2, "Bob"), (3, "Charlie"), (4, "David")]
    desc = [FakeDescription("id"), FakeDescription("name")]
    cursor = FakeCursor(rows=rows, description=desc)
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    result = driver.execute("SELECT id, name FROM users", limit=2, timeout=5)

    assert result.row_count == 2
    assert result.truncated is True
    assert result.column_names == ["id", "name"]
    assert result.rows == [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    assert any("statement_timeout = 5000" in stmt[0] for stmt in conn.executed_statements)


def test_postgres_execute_mutation_success(monkeypatch):
    # Non-SELECT has description=None
    cursor = FakeCursor(rows=[], description=None, rowcount=3)
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    result = driver.execute("UPDATE users SET active = true", timeout=10)

    assert result.row_count == 3
    assert result.columns == []
    assert result.rows == []
    assert conn.committed is True


def test_postgres_read_only_mode_enforced(monkeypatch):
    ro_config = {**CONFIG, "read_only": True}

    def fake_execute(statement, params=None):
        raise ReadOnlySqlTransaction("cannot execute INSERT in a read-only transaction")

    cursor = FakeCursor()
    cursor.execute = fake_execute
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(ro_config)
    with pytest.raises(DriverReadOnlyError) as exc_info:
        driver.execute("INSERT INTO users(name) VALUES ('Hacker')")
    assert "read-only mode" in str(exc_info.value)
    assert conn.rolled_back is True


def test_postgres_statement_timeout_translated(monkeypatch):
    def fake_execute(statement, params=None):
        raise QueryCanceled("canceling statement due to statement timeout")

    cursor = FakeCursor()
    cursor.execute = fake_execute
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    with pytest.raises(DriverTimeoutError) as exc_info:
        driver.execute("SELECT pg_sleep(10)", timeout=2)
    assert "timed out after 2 seconds" in str(exc_info.value)


def test_postgres_user_cancelled_translated(monkeypatch):
    def fake_execute(statement, params=None):
        raise QueryCanceled("canceling statement due to user request")

    cursor = FakeCursor()
    cursor.execute = fake_execute
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    with pytest.raises(DriverCancelledError) as exc_info:
        driver.execute("SELECT pg_sleep(10)", timeout=30)
    assert "cancelled by the user" in str(exc_info.value)


def test_postgres_cancel_executes_pg_cancel_backend(monkeypatch):
    from apps.drivers.pool import run_tracker

    run_tracker.register("run-123", "conn-1", "postgres", 9988)

    cancel_cursor = FakeCursor(rows=[(True,)])
    cancel_conn = FakeConnection(cursor_obj=cancel_cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: cancel_conn)

    driver = PostgresDriver(CONFIG)
    assert driver.cancel("run-123") is True
    assert any("pg_cancel_backend" in q[0] and q[1] == (9988,) for q in cancel_cursor.executed_queries)


def test_postgres_list_schemas(monkeypatch):
    cursor = FakeCursor(rows=[("public",), ("analytics",)])
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    schemas = driver.list_schemas()
    assert schemas == ["public", "analytics"]


def test_postgres_list_tables(monkeypatch):
    cursor = FakeCursor(rows=[("users", "BASE TABLE", 1000), ("active_users", "VIEW", 0)])
    conn = FakeConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    tables = driver.list_tables("public")
    assert len(tables) == 2
    assert tables[0].name == "users"
    assert tables[0].type == "table"
    assert tables[0].row_count_estimate == 1000
    assert tables[1].name == "active_users"
    assert tables[1].type == "view"


def test_postgres_describe_table(monkeypatch):
    col_rows = [
        ("id", "integer", "int4", "NO", "nextval('users_id_seq')", 1),
        ("name", "character varying", "varchar", "NO", None, 2),
        ("org_id", "integer", "int4", "YES", None, 3),
    ]
    pk_rows = [("id",)]
    fk_rows = [("org_id", "public", "organizations", "id", "fk_users_org")]

    class MultiQueryCursor:
        def __init__(self):
            self.step = 0

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, q, params=None):
            pass

        def fetchall(self):
            self.step += 1
            if self.step == 1:
                return col_rows
            if self.step == 2:
                return pk_rows
            if self.step == 3:
                return fk_rows
            return []

    conn = FakeConnection(cursor_obj=MultiQueryCursor())
    monkeypatch.setattr("apps.drivers.postgres.psycopg.connect", lambda **kwargs: conn)

    driver = PostgresDriver(CONFIG)
    columns = driver.describe_table("public", "users")
    assert len(columns) == 3

    id_col = columns[0]
    assert id_col.name == "id"
    assert id_col.is_primary_key is True
    assert id_col.generic_type == "number"

    org_col = columns[2]
    assert org_col.name == "org_id"
    assert org_col.foreign_key is not None
    assert org_col.foreign_key.target_table == "organizations"
    assert org_col.foreign_key.target_column == "id"
