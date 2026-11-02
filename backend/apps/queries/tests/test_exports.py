from __future__ import annotations

from decimal import Decimal
import json
from unittest.mock import MagicMock, patch
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.connections.models import Connection
from apps.drivers.base import ColumnMeta, TableMeta
from apps.queries.export import (
    build_streaming_export_response,
    format_export_val,
    stream_csv,
    stream_json,
    stream_jsonl,
)
from apps.queries.models import QueryHistory

User = get_user_model()


@pytest.fixture
def auth_client():
    user = User.objects.create_user(
        email="export_user@example.com",
        password="ValidPassword123!",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def other_user():
    return User.objects.create_user(
        email="other_export_user@example.com",
        password="ValidPassword123!",
    )


@pytest.fixture
def target_connection(auth_client):
    client, user = auth_client
    return Connection.objects.create(
        name="Export DB",
        engine=Connection.Engine.POSTGRES,
        host="localhost",
        port=5432,
        db_name="exportdb",
        username="postgres",
        owner=user,
    )


class DummyStreamingDriver:
    """Mock driver yielding test result chunks."""

    def __init__(self, data=None):
        self.data = data or [
            (["id", "name", "price", "is_active", "metadata"], [
                [1, "Product A", Decimal("19.99"), True, {"tags": ["sale"]}],
                [2, "Product B, with comma", Decimal("5.00"), False, None],
                [3, 'Product "C" Quotes', Decimal("100.50"), True, {"desc": "premium"}],
            ])
        ]

    def stream_query(self, sql, params=None, chunk_size=1000, timeout=60, max_rows=None):
        fetched = 0
        for col_names, rows in self.data:
            if max_rows is not None and fetched >= max_rows:
                break
            to_yield = rows[:max_rows - fetched] if max_rows is not None else rows
            fetched += len(to_yield)
            yield col_names, to_yield

    def close(self):
        pass


class TestExportStreamers:
    """Unit tests for low-level stream formatters (CSV, JSON, JSONL)."""

    def test_format_export_val(self):
        assert format_export_val(None) is None
        assert format_export_val(True) is True
        assert format_export_val(42) == 42
        assert format_export_val(Decimal("12.34")) == 12.34
        uid = uuid.uuid4()
        assert format_export_val(uid) == str(uid)
        assert format_export_val(b"test") == "<binary: 4 bytes>"

    def test_stream_csv(self):
        driver = DummyStreamingDriver()
        chunks = list(stream_csv(driver, "SELECT 1"))
        csv_text = "".join(chunks)

        lines = csv_text.strip().split("\n")
        assert len(lines) == 4
        assert lines[0] == "id,name,price,is_active,metadata"
        assert lines[1].startswith("1,Product A,19.99,True")
        # Ensure RFC 4180 escaping on comma and quotes
        assert '"Product B, with comma"' in lines[2]
        assert '"Product ""C"" Quotes"' in lines[3]

    def test_stream_json(self):
        driver = DummyStreamingDriver()
        chunks = list(stream_json(driver, "SELECT 1"))
        json_text = "".join(chunks)

        parsed = json.loads(json_text)
        assert isinstance(parsed, list)
        assert len(parsed) == 3
        assert parsed[0]["id"] == 1
        assert parsed[0]["price"] == 19.99
        assert parsed[0]["is_active"] is True
        assert parsed[1]["name"] == "Product B, with comma"
        assert parsed[2]["name"] == 'Product "C" Quotes'

    def test_stream_jsonl(self):
        driver = DummyStreamingDriver()
        chunks = list(stream_jsonl(driver, "SELECT 1"))
        jsonl_text = "".join(chunks)

        lines = [line for line in jsonl_text.strip().split("\n") if line]
        assert len(lines) == 3
        first_row = json.loads(lines[0])
        assert first_row["id"] == 1
        assert first_row["name"] == "Product A"

    def test_stream_max_rows(self):
        driver = DummyStreamingDriver()
        chunks = list(stream_csv(driver, "SELECT 1", max_rows=1))
        csv_text = "".join(chunks)
        lines = csv_text.strip().split("\n")
        assert len(lines) == 2  # header + 1 row


@pytest.mark.django_db
class TestQueryExportEndpoints:
    """Integration tests for export HTTP views."""

    def test_export_by_run_id_csv(self, auth_client, target_connection):
        client, user = auth_client
        run_id = str(uuid.uuid4())

        history = QueryHistory.objects.create(
            id=uuid.UUID(run_id),
            user=user,
            connection=target_connection,
            sql="SELECT * FROM products;",
            status=QueryHistory.Status.SUCCESS,
            duration_ms=50,
            row_count=3,
        )

        with patch("apps.queries.views.get_driver") as mock_get_driver:
            mock_get_driver.return_value = DummyStreamingDriver()

            url = f"/api/connections/{target_connection.id}/query/{run_id}/export/?format=csv"
            resp = client.get(url)

            if resp.status_code != 200:
                print("DEBUG EXPORT RESP:", resp.status_code, getattr(resp, "data", None))

            assert resp.status_code == status.HTTP_200_OK
            assert "text/csv" in resp["Content-Type"]
            assert f"export_{run_id[:8]}.csv" in resp["Content-Disposition"]

            content = "".join(c.decode() if isinstance(c, bytes) else c for c in resp.streaming_content)
            assert "id,name,price" in content
            assert "Product A" in content

    def test_export_by_run_id_json(self, auth_client, target_connection):
        client, user = auth_client
        run_id = str(uuid.uuid4())

        QueryHistory.objects.create(
            id=uuid.UUID(run_id),
            user=user,
            connection=target_connection,
            sql="SELECT * FROM products;",
            status=QueryHistory.Status.SUCCESS,
        )

        with patch("apps.queries.views.get_driver") as mock_get_driver:
            mock_get_driver.return_value = DummyStreamingDriver()

            url = f"/api/connections/{target_connection.id}/query/{run_id}/export/?format=json"
            resp = client.get(url)

            assert resp.status_code == status.HTTP_200_OK
            assert "application/json" in resp["Content-Type"]

            content = "".join(c.decode() if isinstance(c, bytes) else c for c in resp.streaming_content)
            data = json.loads(content)
            assert len(data) == 3
            assert data[0]["name"] == "Product A"

    def test_export_by_run_id_not_found(self, auth_client, target_connection):
        client, user = auth_client
        missing_run_id = str(uuid.uuid4())
        url = f"/api/connections/{target_connection.id}/query/{missing_run_id}/export/"
        resp = client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_export_by_run_id_forbidden_other_user(self, auth_client, other_user, target_connection):
        client, user = auth_client
        run_id = str(uuid.uuid4())

        # History owned by other_user
        QueryHistory.objects.create(
            id=uuid.UUID(run_id),
            user=other_user,
            connection=target_connection,
            sql="SELECT 1;",
            status=QueryHistory.Status.SUCCESS,
        )

        url = f"/api/connections/{target_connection.id}/query/{run_id}/export/"
        resp = client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_direct_query_export_post(self, auth_client, target_connection):
        client, user = auth_client

        with patch("apps.queries.views.get_driver") as mock_get_driver:
            mock_get_driver.return_value = DummyStreamingDriver()

            url = f"/api/connections/{target_connection.id}/query/export/"
            resp = client.post(
                url,
                {"sql": "SELECT * FROM products;", "format": "csv", "filename": "my_export"},
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK
            assert "text/csv" in resp["Content-Type"]
            assert 'filename="my_export.csv"' in resp["Content-Disposition"]

            content = "".join(c.decode() if isinstance(c, bytes) else c for c in resp.streaming_content)
            assert "Product A" in content

    def test_direct_query_export_read_only_blocks_mutation(self, auth_client, target_connection):
        client, user = auth_client
        target_connection.read_only = True
        target_connection.save()

        url = f"/api/connections/{target_connection.id}/query/export/"
        resp = client.post(
            url,
            {"sql": "DELETE FROM products;", "format": "csv"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestTableBrowseExport:
    """Integration tests for Data Browser filtered table export."""

    def test_table_browse_export_csv(self, auth_client, target_connection):
        client, user = auth_client

        with patch("apps.browser.views._resolve_table_and_columns") as mock_resolve, \
             patch("apps.browser.views.get_driver") as mock_get_driver:

            mock_resolve.return_value = (
                "public",
                "products",
                [
                    ColumnMeta(name="id", data_type="integer", generic_type="number", is_primary_key=True),
                    ColumnMeta(name="name", data_type="text", generic_type="text"),
                    ColumnMeta(name="price", data_type="numeric", generic_type="number"),
                ],
            )
            mock_get_driver.return_value = DummyStreamingDriver()

            url = f"/api/connections/{target_connection.id}/tables/products/export/?format=csv&search=Product"
            resp = client.get(url)

            assert resp.status_code == status.HTTP_200_OK
            assert "text/csv" in resp["Content-Type"]
            assert "products_export.csv" in resp["Content-Disposition"]

            content = "".join(c.decode() if isinstance(c, bytes) else c for c in resp.streaming_content)
            assert "Product A" in content
