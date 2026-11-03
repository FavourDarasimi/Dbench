import json
from unittest.mock import MagicMock
from django.core.cache import cache
import pytest
from rest_framework.exceptions import ValidationError

from apps.browser.builder import BrowseQueryBuilder, quote_identifier
from apps.connections.crypto import encrypt
from apps.connections.models import Connection
from apps.drivers.base import ColumnMeta, QueryResult
from apps.explorer.services import schema_cache
from apps.queries.models import QueryHistory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def sample_columns():
    return [
        ColumnMeta(name="id", data_type="int4", generic_type="number", nullable=False, is_primary_key=True),
        ColumnMeta(name="name", data_type="varchar", generic_type="text", nullable=False),
        ColumnMeta(name="email", data_type="varchar", generic_type="text", nullable=True),
        ColumnMeta(name="age", data_type="int4", generic_type="number", nullable=True),
        ColumnMeta(name="is_active", data_type="bool", generic_type="boolean", nullable=False),
    ]


@pytest.fixture
def test_connection(user):
    return Connection.objects.create(
        owner=user,
        name="browser-db",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
        encrypted_password=encrypt("pass"),
        read_only=False,
    )


# --- 1. Query Builder Unit Tests ---


def test_quote_identifier():
    assert quote_identifier("users", "postgres") == '"users"'
    assert quote_identifier('my"table', "postgres") == '"my""table"'
    assert quote_identifier("users", "mysql") == "`users`"
    assert quote_identifier("my`table", "mysql") == "`my``table`"

    with pytest.raises(ValidationError):
        quote_identifier("bad\x00name")


def test_builder_basic_select(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        dialect="postgres",
        page=1,
        page_size=50,
    )
    sql, params = builder.build()
    assert sql == 'SELECT * FROM "public"."users" ORDER BY "id" ASC LIMIT 50 OFFSET 0;'
    assert params == []


def test_builder_sorting(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        sort="-age,name:asc",
    )
    sql, params = builder.build()
    assert 'ORDER BY "age" DESC, "name" ASC' in sql


def test_builder_rejects_unknown_sort_column(sample_columns):
    with pytest.raises(ValidationError) as exc:
        BrowseQueryBuilder(
            schema="public",
            table="users",
            columns=sample_columns,
            sort="hacked_col:desc",
        )
    assert "Invalid sort column: 'hacked_col'" in str(exc.value)


def test_builder_filters(sample_columns):
    filters = [
        {"column": "age", "op": "gte", "value": 18},
        {"column": "name", "op": "starts_with", "value": "A"},
        {"column": "email", "op": "not_null"},
        {"column": "is_active", "op": "eq", "value": True},
        {"column": "id", "op": "in", "value": [1, 2, 3]},
        {"column": "age", "op": "between", "value": [20, 30]},
    ]
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        filters=filters,
    )
    sql, params = builder.build()
    assert '"age" >= %s' in sql
    assert '"name" ILIKE %s' in sql
    assert '"email" IS NOT NULL' in sql
    assert '"is_active" = %s' in sql
    assert '"id" IN (%s, %s, %s)' in sql
    assert '"age" BETWEEN %s AND %s' in sql
    assert params == [18, "A%", True, 1, 2, 3, 20, 30]


def test_builder_rejects_unknown_filter_column(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        filters=[{"column": "secret_token", "op": "eq", "value": "xyz"}],
    )
    with pytest.raises(ValidationError) as exc:
        builder.build()
    assert "Invalid filter column: 'secret_token'" in str(exc.value)


def test_builder_global_text_search(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        search="alice",
    )
    sql, params = builder.build()
    assert '("name" ILIKE %s OR "email" ILIKE %s)' in sql
    assert params == ["%alice%", "%alice%"]


def test_builder_sql_preview_rendering(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        filters=[{"column": "name", "op": "eq", "value": "O'Connor"}],
    )
    preview = builder.render_sql_preview()
    assert '"name" = \'O\'\'Connor\'' in preview


# --- 2. API Endpoint Integration Tests ---


def setup_mock_schema(monkeypatch, sample_columns):
    # Mock schema_cache
    monkeypatch.setattr(
        "apps.browser.views.schema_cache.get_tables",
        lambda conn, schema: [{"name": "users", "schema": schema, "type": "table"}],
    )
    monkeypatch.setattr(
        "apps.browser.views.schema_cache.get_columns",
        lambda conn, schema, table: [c.to_dict() for c in sample_columns],
    )


def test_browse_rows_endpoint(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult(
        columns=sample_columns,
        column_names=["id", "name", "email", "age", "is_active"],
        rows=[{"id": 1, "name": "Alice", "email": "a@example.com", "age": 25, "is_active": True}],
        row_count=1,
        duration_ms=10,
        truncated=False,
    )
    monkeypatch.setattr("apps.browser.services.get_driver", lambda config: mock_driver)

    resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/rows/?page=1&page_size=20")
    assert resp.status_code == 200, resp.data
    assert resp.data["table"] == "users"
    assert resp.data["row_count"] == 1
    assert resp.data["rows"][0]["name"] == "Alice"
    assert "total_rows" in resp.data

    # QueryHistory was recorded with source='browser'
    history = QueryHistory.objects.filter(connection=test_connection, source="browser").first()
    assert history is not None
    assert 'FROM "public"."users"' in history.sql


def test_browse_table_not_found(auth_client, test_connection, monkeypatch):
    monkeypatch.setattr(
        "apps.browser.views.schema_cache.get_tables",
        lambda conn, schema: [],
    )
    resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/ghost_table/rows/")
    assert resp.status_code == 404
    assert "ghost_table" in resp.data["detail"]


def test_table_row_count_endpoint(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    mock_driver = MagicMock()
    # Fast estimate return
    mock_driver.execute.return_value = QueryResult([], [], [{"reltuples": 150}], 1, 5, False)
    monkeypatch.setattr("apps.browser.services.get_driver", lambda config: mock_driver)

    resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/count/")
    assert resp.status_code == 200, resp.data
    assert resp.data["count"] == 150
    assert resp.data["is_exact"] is False

    # Exact count requested
    mock_driver.execute.return_value = QueryResult([], [], [{"count": 142}], 1, 15, False)
    exact_resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/count/?exact=true")
    assert exact_resp.status_code == 200
    assert exact_resp.data["count"] == 142
    assert exact_resp.data["is_exact"] is True


def test_row_detail_with_related_counts(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    class MockMultiQueryDriver:
        def __init__(self):
            self.closed = False

        def execute(self, sql, params=None, **kwargs):
            if "WHERE \"id\" = %s" in sql:
                return QueryResult([], [], [{"id": 42, "name": "Bob"}], 1, 5, False)
            if "tc.constraint_type = 'FOREIGN KEY'" in sql:
                # Referencing foreign keys
                return QueryResult(
                    [],
                    [],
                    [{"table_schema": "public", "table_name": "orders", "column_name": "user_id"}],
                    1,
                    5,
                    False,
                )
            if 'FROM "public"."orders"' in sql:
                return QueryResult([], [], [{"count": 3}], 1, 5, False)
            return QueryResult([], [], [], 0, 5, False)

        def close(self):
            self.closed = True

    monkeypatch.setattr("apps.browser.services.get_driver", lambda config: MockMultiQueryDriver())

    resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/rows/42/")
    assert resp.status_code == 200, resp.data
    assert resp.data["pk_column"] == "id"
    assert resp.data["pk_value"] == "42"
    assert resp.data["row"]["name"] == "Bob"
    assert len(resp.data["related"]) == 1
    assert resp.data["related"][0]["table"] == "orders"
    assert resp.data["related"][0]["count"] == 3


def test_sql_preview_endpoint(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    payload = {
        "page": 2,
        "page_size": 25,
        "sort": "name:asc",
        "filters": json.dumps([{"column": "age", "op": "gt", "value": 21}]),
    }
    resp = auth_client.post(
        f"/api/connections/{test_connection.id}/tables/users/sql-preview/",
        payload,
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert 'LIMIT 25 OFFSET 25' in resp.data["sql"]
    assert '"age" > 21' in resp.data["sql"]
    assert "raw_sql" in resp.data
    assert resp.data["params"] == ["21"]


def test_builder_select_columns_projection(sample_columns):
    builder = BrowseQueryBuilder(
        schema="public",
        table="users",
        columns=sample_columns,
        dialect="postgres",
        select_columns="id,name",
    )
    sql, params = builder.build()
    assert sql.startswith('SELECT "id", "name" FROM "public"."users"')

    # Invalid column raises ValidationError
    with pytest.raises(ValidationError):
        BrowseQueryBuilder(
            schema="public",
            table="users",
            columns=sample_columns,
            select_columns="id,nonexistent",
        )


def test_browse_rows_filtered_omits_blocking_count(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    mock_driver = MagicMock()
    mock_driver.execute.return_value = QueryResult(
        columns=sample_columns,
        column_names=["id", "name"],
        rows=[{"id": 1, "name": "Alice"}],
        row_count=1,
        duration_ms=5,
        truncated=False,
    )
    monkeypatch.setattr("apps.browser.services.get_driver", lambda config: mock_driver)

    filters = json.dumps([{"column": "name", "op": "eq", "value": "Alice"}])
    resp = auth_client.get(
        f"/api/connections/{test_connection.id}/tables/users/rows/?filters={filters}&columns=id,name"
    )
    assert resp.status_code == 200, resp.data
    # With filters active, total_rows is None to prevent expensive blocking table scans
    assert resp.data["total_rows"] is None
    assert resp.data["row_count"] == 1


def test_row_detail_batched_union_all_counts(auth_client, test_connection, sample_columns, monkeypatch):
    setup_mock_schema(monkeypatch, sample_columns)

    executed_queries = []

    class MockBatchDriver:
        def __init__(self):
            self.closed = False

        def execute(self, sql, params=None, **kwargs):
            executed_queries.append(sql)
            if 'WHERE "id" = %s' in sql:
                return QueryResult([], [], [{"id": 42, "name": "Bob"}], 1, 5, False)
            if "tc.constraint_type = 'FOREIGN KEY'" in sql:
                # Two referencing tables
                return QueryResult(
                    [],
                    [],
                    [
                        {"table_schema": "public", "table_name": "orders", "column_name": "user_id"},
                        {"table_schema": "public", "table_name": "reviews", "column_name": "author_id"},
                    ],
                    2,
                    5,
                    False,
                )
            if "UNION ALL" in sql:
                return QueryResult(
                    [],
                    [],
                    [{"rel_idx": 0, "rel_count": 5}, {"rel_idx": 1, "rel_count": 12}],
                    2,
                    5,
                    False,
                )
            return QueryResult([], [], [], 0, 5, False)

        def close(self):
            self.closed = True

    monkeypatch.setattr("apps.browser.services.get_driver", lambda config: MockBatchDriver())

    resp = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/rows/42/")
    assert resp.status_code == 200, resp.data
    assert len(resp.data["related"]) == 2
    assert resp.data["related"][0]["table"] == "orders"
    assert resp.data["related"][0]["count"] == 5
    assert resp.data["related"][1]["table"] == "reviews"
    assert resp.data["related"][1]["count"] == 12
    # Check that UNION ALL was executed to batch the counts
    assert any("UNION ALL" in q for q in executed_queries)
