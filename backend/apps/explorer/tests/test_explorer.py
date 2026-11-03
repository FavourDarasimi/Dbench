from unittest.mock import MagicMock
from django.core.cache import cache
import pytest

from apps.connections.crypto import encrypt
from apps.connections.models import Connection
from apps.drivers.base import ColumnMeta, DriverConnectionError, ForeignKeyMeta, TableMeta

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def test_connection(user):
    return Connection.objects.create(
        owner=user,
        name="test-pg",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="testdb",
        username="postgres",
        encrypted_password=encrypt("secret"),
        ssl_mode="prefer",
        read_only=False,
    )


class MockDriver:
    def __init__(self):
        self.list_schemas_calls = 0
        self.list_tables_calls = 0
        self.describe_table_calls = 0
        self.describe_schema_erd_calls = 0
        self.closed = False

    def list_schemas(self):
        self.list_schemas_calls += 1
        return ["public", "analytics"]

    def list_tables(self, schema):
        self.list_tables_calls += 1
        if schema == "public":
            return [
                TableMeta(name="users", schema="public", type="table", row_count_estimate=120),
                TableMeta(name="orders", schema="public", type="table", row_count_estimate=450),
            ]
        return [TableMeta(name="daily_stats", schema="analytics", type="view", row_count_estimate=30)]

    def describe_table(self, schema, table):
        self.describe_table_calls += 1
        return [
            ColumnMeta(
                name="id",
                data_type="int4",
                generic_type="number",
                nullable=False,
                is_primary_key=True,
            ),
            ColumnMeta(
                name="email",
                data_type="varchar",
                generic_type="text",
                nullable=False,
                is_primary_key=False,
            ),
            ColumnMeta(
                name="org_id",
                data_type="int4",
                generic_type="number",
                nullable=True,
                foreign_key=ForeignKeyMeta(
                    target_schema="public",
                    target_table="organizations",
                    target_column="id",
                    constraint_name="fk_users_org",
                ),
            ),
        ]

    def describe_schema_erd(self, schema):
        self.describe_schema_erd_calls += 1
        return {
            "schema": schema,
            "tables": [
                {
                    "name": "users",
                    "schema": schema,
                    "type": "table",
                    "columns": [c.to_dict() for c in self.describe_table(schema, "users")],
                },
                {
                    "name": "orders",
                    "schema": schema,
                    "type": "table",
                    "columns": [c.to_dict() for c in self.describe_table(schema, "orders")],
                },
            ],
            "relations": [
                {
                    "id": "rel-users-org_id-organizations-id",
                    "source_schema": schema,
                    "source_table": "users",
                    "source_column": "org_id",
                    "target_schema": "public",
                    "target_table": "organizations",
                    "target_column": "id",
                    "constraint_name": "fk_users_org",
                }
            ],
        }

    def close(self):
        self.closed = True


# --- Authentication & Authorization ---


def test_explorer_requires_authentication(api_client, test_connection):
    conn_id = test_connection.id
    assert api_client.get(f"/api/connections/{conn_id}/schemas/").status_code == 403
    assert api_client.get(f"/api/connections/{conn_id}/schemas/public/tables/").status_code == 403
    assert api_client.get(f"/api/connections/{conn_id}/tables/users/columns/").status_code == 403
    assert api_client.get(f"/api/connections/{conn_id}/schema-tree/").status_code == 403
    assert api_client.get(f"/api/connections/{conn_id}/erd/").status_code == 403
    assert api_client.post(f"/api/connections/{conn_id}/refresh-schema/").status_code == 403


def test_explorer_cannot_access_other_users_connection(auth_client, user_factory, test_connection):
    other = user_factory(email="other@example.com")
    theirs = Connection.objects.create(
        owner=other,
        name="theirs",
        engine="postgres",
        host="localhost",
        port=5432,
        db_name="otherdb",
        username="u",
    )
    assert auth_client.get(f"/api/connections/{theirs.id}/schemas/").status_code == 404
    assert auth_client.get(f"/api/connections/{theirs.id}/schema-tree/").status_code == 404
    assert auth_client.get(f"/api/connections/{theirs.id}/erd/").status_code == 404
    assert auth_client.post(f"/api/connections/{theirs.id}/refresh-schema/").status_code == 404


# --- Schemas ---


def test_list_schemas_and_caching(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    # 1. First fetch hits driver
    resp1 = auth_client.get(f"/api/connections/{test_connection.id}/schemas/")
    assert resp1.status_code == 200, resp1.data
    assert resp1.data["schemas"] == ["public", "analytics"]
    assert mock.list_schemas_calls == 1

    # 2. Second fetch uses cache (driver not called again)
    resp2 = auth_client.get(f"/api/connections/{test_connection.id}/schemas/")
    assert resp2.status_code == 200
    assert resp2.data["schemas"] == ["public", "analytics"]
    assert mock.list_schemas_calls == 1

    # 3. Force refresh bypasses cache
    resp3 = auth_client.get(f"/api/connections/{test_connection.id}/schemas/?refresh=true")
    assert resp3.status_code == 200
    assert mock.list_schemas_calls == 2


# --- Tables ---


def test_list_tables_and_caching(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    resp1 = auth_client.get(f"/api/connections/{test_connection.id}/schemas/public/tables/")
    assert resp1.status_code == 200, resp1.data
    tables = resp1.data["tables"]
    assert len(tables) == 2
    assert tables[0]["name"] == "users"
    assert tables[0]["type"] == "table"
    assert tables[0]["row_count_estimate"] == 120
    assert mock.list_tables_calls == 1

    # Second call cached
    resp2 = auth_client.get(f"/api/connections/{test_connection.id}/schemas/public/tables/")
    assert resp2.status_code == 200
    assert mock.list_tables_calls == 1


# --- Columns ---


def test_describe_columns_via_nested_and_dot_notation(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    # Via /schemas/{schema}/tables/{table}/columns/
    resp = auth_client.get(f"/api/connections/{test_connection.id}/schemas/public/tables/users/columns/")
    assert resp.status_code == 200, resp.data
    cols = resp.data["columns"]
    assert len(cols) == 3
    assert cols[0]["name"] == "id"
    assert cols[0]["is_primary_key"] is True
    assert cols[2]["foreign_key"]["target_table"] == "organizations"

    # Via /tables/{schema.table}/columns/
    resp_dot = auth_client.get(f"/api/connections/{test_connection.id}/tables/public.users/columns/")
    assert resp_dot.status_code == 200
    assert resp_dot.data["schema"] == "public"
    assert resp_dot.data["table"] == "users"

    # Plain table defaults to public in Postgres
    resp_plain = auth_client.get(f"/api/connections/{test_connection.id}/tables/users/columns/")
    assert resp_plain.status_code == 200
    assert resp_plain.data["schema"] == "public"


# --- Schema Tree ---


def test_get_schema_tree(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    resp = auth_client.get(f"/api/connections/{test_connection.id}/schema-tree/")
    assert resp.status_code == 200, resp.data
    tree = resp.data["tree"]
    assert len(tree) == 2
    assert tree[0]["schema"] == "public"
    assert len(tree[0]["tables"]) == 2
    assert tree[1]["schema"] == "analytics"
    assert len(tree[1]["tables"]) == 1


# --- Refresh Schema ---


def test_refresh_schema_invalidates_cache(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    # Populate cache
    auth_client.get(f"/api/connections/{test_connection.id}/schemas/")
    assert mock.list_schemas_calls == 1

    # Invalidate
    refresh_resp = auth_client.post(f"/api/connections/{test_connection.id}/refresh-schema/")
    assert refresh_resp.status_code == 200
    assert refresh_resp.data["status"] == "ok"

    # Next fetch hits driver again
    auth_client.get(f"/api/connections/{test_connection.id}/schemas/")
    assert mock.list_schemas_calls == 2


# --- Database Error Handling ---


def test_driver_error_returns_503(auth_client, test_connection, monkeypatch):
    def failing_driver(config):
        raise DriverConnectionError("Connection refused by target database")

    monkeypatch.setattr("apps.explorer.services.get_driver", failing_driver)

    resp = auth_client.get(f"/api/connections/{test_connection.id}/schemas/")
    assert resp.status_code == 503
    assert "Connection refused" in resp.data["detail"]


# --- ERD Schema Graph ---


def test_get_erd_default_schema(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    resp = auth_client.get(f"/api/connections/{test_connection.id}/erd/")
    assert resp.status_code == 200, resp.data
    assert resp.data["schema"] == "public"
    assert len(resp.data["tables"]) == 2
    assert len(resp.data["relations"]) == 1
    rel = resp.data["relations"][0]
    assert rel["source_table"] == "users"
    assert rel["source_column"] == "org_id"
    assert rel["target_table"] == "organizations"
    assert rel["target_column"] == "id"


def test_get_erd_explicit_schema(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    # Test via query param ?schema=analytics
    resp = auth_client.get(f"/api/connections/{test_connection.id}/erd/?schema=analytics")
    assert resp.status_code == 200, resp.data
    assert resp.data["schema"] == "analytics"

    # Test via path /schemas/analytics/erd/
    resp_path = auth_client.get(f"/api/connections/{test_connection.id}/schemas/analytics/erd/")
    assert resp_path.status_code == 200, resp_path.data
    assert resp_path.data["schema"] == "analytics"


def test_erd_caching_and_refresh(auth_client, test_connection, monkeypatch):
    mock = MockDriver()
    monkeypatch.setattr("apps.explorer.services.get_driver", lambda config: mock)

    # 1. First fetch populates cache
    auth_client.get(f"/api/connections/{test_connection.id}/erd/")
    assert mock.describe_schema_erd_calls == 1

    # 2. Second fetch hits cache
    auth_client.get(f"/api/connections/{test_connection.id}/erd/")
    assert mock.describe_schema_erd_calls == 1

    # 3. Force refresh via ?refresh=true hits driver
    auth_client.get(f"/api/connections/{test_connection.id}/erd/?refresh=true")
    assert mock.describe_schema_erd_calls == 2

