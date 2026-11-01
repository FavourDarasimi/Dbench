from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.connections.models import Connection
from apps.drivers.base import ColumnMeta, ForeignKeyMeta
from apps.explorer.services import schema_cache

from .builder import BrowseQueryBuilder
from .serializers import (
    BrowseRequestSerializer,
    BrowseResponseSerializer,
    RowCountResponseSerializer,
    RowDetailResponseSerializer,
    SqlPreviewResponseSerializer,
)
from .services import execute_browse, get_row_detail_with_related, get_table_row_count

logger = logging.getLogger(__name__)


def _get_connection(request, connection_id) -> Connection:
    try:
        return Connection.objects.get(pk=connection_id, owner=request.user)
    except (Connection.DoesNotExist, ValueError):
        raise NotFound("Connection not found.")


def _resolve_table_and_columns(
    connection: Connection,
    table_ref: str | None = None,
    schema: str | None = None,
    table: str | None = None,
) -> tuple[str, str, list[ColumnMeta]]:
    """Resolve schema, table name, and validate against introspected metadata whitelist."""
    if table_ref:
        if "." in table_ref:
            schema_name, table_name = table_ref.split(".", 1)
        else:
            schema_name = "public" if connection.engine == Connection.Engine.POSTGRES else connection.db_name
            table_name = table_ref
    else:
        schema_name = schema or ("public" if connection.engine == Connection.Engine.POSTGRES else connection.db_name)
        table_name = table or ""

    schema_name = schema_name.strip()
    table_name = table_name.strip()
    if not table_name:
        raise ValidationError("Table name is required.")

    # Validate that table exists in schema metadata
    tables = schema_cache.get_tables(connection, schema_name)
    table_names = {t["name"] for t in tables}
    if table_name not in table_names:
        raise NotFound(f"Table '{schema_name}.{table_name}' does not exist in target database.")

    # Introspect columns
    columns_raw = schema_cache.get_columns(connection, schema_name, table_name)
    columns = [
        ColumnMeta(
            name=c["name"],
            data_type=c["data_type"],
            generic_type=c["generic_type"],
            nullable=c.get("nullable", True),
            default=c.get("default"),
            is_primary_key=c.get("is_primary_key", False),
            foreign_key=ForeignKeyMeta(**c["foreign_key"]) if c.get("foreign_key") else None,
        )
        for c in columns_raw
    ]
    return schema_name, table_name, columns


class BrowseRowsView(APIView):
    """
    GET /api/connections/{id}/tables/{table_ref}/rows/
    GET /api/connections/{id}/schemas/{schema}/tables/{table}/rows/
    Browse rows without SQL, with server-side pagination, sorting, filters, and search (PRD F15, F16).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Browse table rows",
        description="Structured table browsing endpoint with pagination, column filters, and text search.",
        parameters=[
            OpenApiParameter("page", int, description="Page number (default 1)"),
            OpenApiParameter("page_size", int, description="Rows per page (default 50, max 500)"),
            OpenApiParameter("sort", str, description="Column sort (e.g. 'created_at:desc' or '-created_at')"),
            OpenApiParameter("filters", str, description="JSON array of column filters"),
            OpenApiParameter("search", str, description="Global text search string"),
            OpenApiParameter("cursor", str, description="Optional keyset pagination cursor JSON"),
        ],
        responses={200: BrowseResponseSerializer},
    )
    def get(self, request, connection_id, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, columns = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )

        serializer = BrowseRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = serializer.to_parsed_params()

        builder = BrowseQueryBuilder(
            schema=schema_name,
            table=table_name,
            columns=columns,
            dialect=connection.engine,
            page=params.get("page", 1),
            page_size=params.get("page_size", 50),
            sort=params.get("sort"),
            filters=params.get("filters"),
            search=params.get("search"),
            cursor=params.get("cursor"),
        )

        payload = execute_browse(connection, request.user, builder)
        return Response(payload, status=status.HTTP_200_OK)


class TableRowCountView(APIView):
    """
    GET /api/connections/{id}/tables/{table_ref}/count/
    GET /api/connections/{id}/schemas/{schema}/tables/{table}/count/
    Estimated or exact row count display (PRD F20).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get row count",
        description="Return fast estimated row count (default) or exact count (?exact=true).",
        parameters=[
            OpenApiParameter("exact", bool, description="Whether to calculate exact COUNT(*)"),
            OpenApiParameter("filters", str, description="JSON array of active filters to count matching rows"),
            OpenApiParameter("search", str, description="Search term to count matching rows"),
        ],
        responses={200: RowCountResponseSerializer},
    )
    def get(self, request, connection_id, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, columns = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )

        exact = request.query_params.get("exact", "").lower() in ("1", "true")
        serializer = BrowseRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = serializer.to_parsed_params()

        builder = BrowseQueryBuilder(
            schema=schema_name,
            table=table_name,
            columns=columns,
            dialect=connection.engine,
            filters=params.get("filters"),
            search=params.get("search"),
        )

        count = get_table_row_count(
            connection,
            schema=schema_name,
            table=table_name,
            exact=exact,
            builder=builder,
        )
        return Response({
            "schema": schema_name,
            "table": table_name,
            "count": count,
            "is_exact": exact or bool(builder.filters or builder.search),
        })


class RowDetailView(APIView):
    """
    GET /api/connections/{id}/tables/{table_ref}/rows/{pk}/
    GET /api/connections/{id}/schemas/{schema}/tables/{table}/rows/{pk}/
    Single row detail with referencing foreign-key counts (PRD F17).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get single row detail",
        description="Fetch a single row by primary key along with related-row counts from referencing tables.",
        responses={200: RowDetailResponseSerializer},
    )
    def get(self, request, connection_id, pk, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, _ = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )

        payload = get_row_detail_with_related(connection, schema=schema_name, table=table_name, pk_value=pk)
        return Response(payload, status=status.HTTP_200_OK)


class SqlPreviewView(APIView):
    """
    POST /api/connections/{id}/tables/{table_ref}/sql-preview/
    POST /api/connections/{id}/schemas/{schema}/tables/{table}/sql-preview/
    Show SQL: returns the exact SQL compiled for the given browse parameters (PRD F19).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Preview generated SQL",
        description="Return the compiled SQL query generated for the current browse parameters.",
        request=BrowseRequestSerializer,
        responses={200: SqlPreviewResponseSerializer},
    )
    def post(self, request, connection_id, table_ref=None, schema=None, table=None):
        return self._handle_preview(request, connection_id, table_ref, schema, table)

    def get(self, request, connection_id, table_ref=None, schema=None, table=None):
        return self._handle_preview(request, connection_id, table_ref, schema, table)

    def _handle_preview(self, request, connection_id, table_ref, schema, table):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, columns = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )

        data = request.data if request.method == "POST" else request.query_params
        serializer = BrowseRequestSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        params = serializer.to_parsed_params()

        builder = BrowseQueryBuilder(
            schema=schema_name,
            table=table_name,
            columns=columns,
            dialect=connection.engine,
            page=params.get("page", 1),
            page_size=params.get("page_size", 50),
            sort=params.get("sort"),
            filters=params.get("filters"),
            search=params.get("search"),
            cursor=params.get("cursor"),
        )

        raw_sql, bound_params = builder.build()
        rendered_sql = builder.render_sql_preview()

        return Response(
            {
                "sql": rendered_sql,
                "raw_sql": raw_sql,
                "params": [str(p) for p in bound_params],
            },
            status=status.HTTP_200_OK,
        )
