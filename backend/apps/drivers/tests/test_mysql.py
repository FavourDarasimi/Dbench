from types import SimpleNamespace
from unittest.mock import MagicMock

import pymysql
import pytest

from apps.drivers.base import (
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
)
from apps.drivers.mysql import MySQLDriver


class FakeMySqlCursor:
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
        res = list(self._rows[:size])
        self._rows = self._rows[size:]
        return res


class FakeMySqlConnection:
    def __init__(self, cursor_obj=None, thread_id_val=54321):
        self._cursor = cursor_obj or FakeMySqlCursor()
        self._thread_id = thread_id_val
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self, cursor=None):
        return self._cursor

    def thread_id(self):
        return self._thread_id

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


CONFIG = {
    "engine": "mysql",
    "host": "localhost",
    "port": 3306,
    "db_name": "testdb",
    "username": "root",
    "password": "secret",
    "ssl_mode": "disable",
    "read_only": False,
}


def test_mysql_test_connection_success(monkeypatch):
    cursor = FakeMySqlCursor(rows=[("8.0.35-MySQL",)])
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    result = driver.test_connection()
    assert result.ok is True
    assert "8.0.35" in result.server_version
    assert isinstance(result.latency_ms, int)


def test_mysql_test_connection_auth_failure(monkeypatch):
    def fake_connect(**kwargs):
        raise pymysql.MySQLError("Access denied for user 'root'@'localhost'")

    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", fake_connect)

    driver = MySQLDriver(CONFIG)
    result = driver.test_connection()
    assert result.ok is False
    assert "Access denied for user" in result.error


def test_mysql_execute_select(monkeypatch):
    rows = [(1, "Alice"), (2, "Bob")]
    desc = [("id", 3, 1, 11, 11, 0, False), ("name", 253, 5, 255, 255, 0, False)]
    cursor = FakeMySqlCursor(rows=rows, description=desc)
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    result = driver.execute("SELECT id, name FROM users", limit=10, timeout=5)

    assert result.row_count == 2
    assert result.truncated is False
    assert result.column_names == ["id", "name"]
    assert result.rows == [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]


def test_mysql_read_only_enforced(monkeypatch):
    ro_config = {**CONFIG, "read_only": True}

    def fake_execute(statement, params=None):
        if "INSERT" in statement:
            raise pymysql.err.OperationalError(1792, "Cannot execute statement in a READ ONLY transaction")

    cursor = FakeMySqlCursor()
    cursor.execute = fake_execute
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(ro_config)
    with pytest.raises(DriverReadOnlyError) as exc_info:
        driver.execute("INSERT INTO users(name) VALUES ('Bob')")
    assert "read-only mode" in str(exc_info.value)
    assert conn.rolled_back is True


def test_mysql_cancel_executes_kill_query(monkeypatch):
    from apps.drivers.pool import run_tracker

    run_tracker.register("run-mysql-42", "conn-mysql", "mysql", 7788)

    cancel_cursor = FakeMySqlCursor()
    cancel_conn = FakeMySqlConnection(cursor_obj=cancel_cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: cancel_conn)

    driver = MySQLDriver(CONFIG)
    assert driver.cancel("run-mysql-42") is True
    assert any("KILL QUERY 7788" in q[0] for q in cancel_cursor.executed_queries)


def test_mysql_list_schemas(monkeypatch):
    cursor = FakeMySqlCursor(rows=[("app_db",), ("analytics_db",)])
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    schemas = driver.list_schemas()
    assert schemas == ["app_db", "analytics_db"]


def test_mysql_list_tables(monkeypatch):
    cursor = FakeMySqlCursor(rows=[("users", "BASE TABLE", 500), ("active_users", "VIEW", 0)])
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    tables = driver.list_tables("app_db")
    assert len(tables) == 2
    assert tables[0].name == "users"
    assert tables[0].type == "table"
    assert tables[0].row_count_estimate == 500
    assert tables[1].name == "active_users"
    assert tables[1].type == "view"


def test_mysql_describe_table_columns_and_fks(monkeypatch):
    cols_data = [
        ("id", "int", "NO", None, "PRI"),
        ("email", "varchar", "NO", None, "UNI"),
        ("org_id", "int", "YES", None, "MUL"),
    ]
    fks_data = [
        ("org_id", "app_db", "organizations", "id", "fk_users_org"),
    ]

    class MultiQueryCursor(FakeMySqlCursor):
        def __init__(self):
            super().__init__()
            self._query_index = 0

        def execute(self, query, params=None):
            super().execute(query, params)
            if "information_schema.columns" in query:
                self._rows = cols_data
            elif "information_schema.key_column_usage" in query:
                self._rows = fks_data

    cursor = MultiQueryCursor()
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    columns = driver.describe_table("app_db", "users")

    assert len(columns) == 3
    assert columns[0].name == "id"
    assert columns[0].is_primary_key is True
    assert columns[0].nullable is False

    assert columns[1].name == "email"
    assert columns[1].is_primary_key is False

    assert columns[2].name == "org_id"
    assert columns[2].foreign_key is not None
    assert columns[2].foreign_key.target_table == "organizations"
    assert columns[2].foreign_key.target_column == "id"
    assert columns[2].foreign_key.constraint_name == "fk_users_org"


def test_mysql_describe_schema_erd(monkeypatch):
    tables_data = [("users", "BASE TABLE", 200)]
    cols_data = [
        ("users", "id", "int", "NO", None, "PRI"),
        ("users", "org_id", "int", "YES", None, "MUL"),
    ]
    fks_data = [
        ("users", "org_id", "app_db", "organizations", "id", "fk_users_org"),
    ]

    class MultiQueryCursor(FakeMySqlCursor):
        def execute(self, query, params=None):
            super().execute(query, params)
            if "information_schema.tables" in query:
                self._rows = tables_data
            elif "information_schema.columns" in query:
                self._rows = cols_data
            elif "information_schema.key_column_usage" in query:
                self._rows = fks_data

    cursor = MultiQueryCursor()
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    erd = driver.describe_schema_erd("app_db")

    assert erd["schema"] == "app_db"
    assert len(erd["tables"]) == 1
    assert erd["tables"][0]["name"] == "users"
    assert len(erd["relations"]) == 1
    assert erd["relations"][0]["source_table"] == "users"
    assert erd["relations"][0]["target_table"] == "organizations"



def test_mysql_stream_query(monkeypatch):
    rows = [(1, "Product 1"), (2, "Product 2"), (3, "Product 3")]
    desc = [("id",), ("name",)]
    cursor = FakeMySqlCursor(rows=rows, description=desc)
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    chunks = list(driver.stream_query("SELECT id, name FROM products", chunk_size=2))

    assert len(chunks) == 2
    col_names, first_chunk = chunks[0]
    assert col_names == ["id", "name"]
    assert len(first_chunk) == 2
    assert first_chunk[0] == (1, "Product 1")

    _, second_chunk = chunks[1]
    assert len(second_chunk) == 1
    assert second_chunk[0] == (3, "Product 3")


def test_mysql_execute_timeout(monkeypatch):
    def fake_execute(statement, params=None):
        if "max_execution_time" not in statement:
            raise pymysql.err.OperationalError(3024, "Query execution was interrupted, max_statement_time exceeded")

    cursor = FakeMySqlCursor()
    cursor.execute = fake_execute
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    with pytest.raises(DriverTimeoutError) as exc_info:
        driver.execute("SELECT SLEEP(10)", timeout=1)
    assert "timed out" in str(exc_info.value).lower()


def test_mysql_execute_non_select(monkeypatch):
    cursor = FakeMySqlCursor(rowcount=5, description=None)
    conn = FakeMySqlConnection(cursor_obj=cursor)
    monkeypatch.setattr("apps.drivers.mysql.pymysql.connect", lambda **kwargs: conn)

    driver = MySQLDriver(CONFIG)
    result = driver.execute("UPDATE products SET price = 10 WHERE category_id = 2")

    assert result.row_count == 5
    assert result.rows == []
    assert result.columns == []
    assert conn.committed is True

