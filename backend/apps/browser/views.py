from __future__ import annotations

import json
import logging
from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.base import (
    ColumnMeta,
    DriverConnectionError,
    DriverError,
    DriverQueryError,
    DriverTimeoutError,
    ForeignKeyMeta,
)
from apps.drivers.factory import get_driver
from apps.explorer.services import schema_cache
from apps.queries.export import build_streaming_export_response
from apps.queries.serializers import ExportQueryParamsSerializer
from apps.queries.views import BaseStreamingExportView
from config.exceptions import sanitize_message

from .builder import BrowseQueryBuilder
from .mutations import execute_row_mutation, execute_staged_mutations
from .serializers import (
    BrowseRequestSerializer,
    BrowseResponseSerializer,
    RowCountResponseSerializer,
    RowDetailResponseSerializer,
    RowMutationRequestSerializer,
    RowMutationResponseSerializer,
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
            select_columns=params.get("columns"),
        )

        try:
            payload = execute_browse(connection, request.user, builder)
            return Response(payload, status=status.HTTP_200_OK)
        except DriverConnectionError as exc:
            return Response(
                {"detail": sanitize_message(str(exc)) or "Unable to connect to the target database."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DriverTimeoutError:
            return Response(
                {"detail": "Query timed out before completing."},
                status=status.HTTP_408_REQUEST_TIMEOUT,
            )
        except DriverQueryError as exc:
            return Response(
                {"detail": sanitize_message(str(exc))},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DriverError as exc:
            return Response(
                {"detail": sanitize_message(str(exc))},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @extend_schema(
        summary="Insert row",
        description="Insert a new row into the table with validation against column metadata.",
        request=None,
        responses={201: RowMutationResponseSerializer},
    )
    def post(self, request, connection_id, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, _ = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )
        data = request.data.get("data") if (isinstance(request.data, dict) and "data" in request.data) else request.data
        preview = bool(request.data.get("preview", False)) if isinstance(request.data, dict) else False

        payload = execute_row_mutation(
            connection=connection,
            user=request.user,
            action="insert",
            schema=schema_name,
            table=table_name,
            data=data,
            preview=preview,
        )
        http_status = status.HTTP_201_CREATED if not preview else status.HTTP_200_OK
        return Response(payload, status=http_status)

    @extend_schema(
        summary="Bulk delete rows",
        description="Delete multiple rows by primary keys.",
        request=None,
        responses={200: RowMutationResponseSerializer},
    )
    def delete(self, request, connection_id, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, _ = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )
        pks = request.data.get("pks") if isinstance(request.data, dict) else None
        preview = bool(request.data.get("preview", False)) if isinstance(request.data, dict) else False
        if not pks:
            raise ValidationError("List of primary keys 'pks' is required in request body for bulk deletion.")

        payload = execute_row_mutation(
            connection=connection,
            user=request.user,
            action="bulk_delete",
            schema=schema_name,
            table=table_name,
            pks=pks,
            preview=preview,
        )
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

    @extend_schema(
        summary="Update row by PK",
        description="Update an existing row by primary key.",
        request=None,
        responses={200: RowMutationResponseSerializer},
    )
    def patch(self, request, connection_id, pk, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, _ = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )
        data = request.data.get("data") if (isinstance(request.data, dict) and "data" in request.data) else request.data
        preview = bool(request.data.get("preview", False)) if isinstance(request.data, dict) else False

        payload = execute_row_mutation(
            connection=connection,
            user=request.user,
            action="update",
            schema=schema_name,
            table=table_name,
            data=data,
            pk=pk,
            preview=preview,
        )
        return Response(payload, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete row by PK",
        description="Delete a row by primary key.",
        request=None,
        responses={200: RowMutationResponseSerializer},
    )
    def delete(self, request, connection_id, pk, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, _ = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )
        preview = bool(request.data.get("preview", False)) if isinstance(request.data, dict) else False

        payload = execute_row_mutation(
            connection=connection,
            user=request.user,
            action="delete",
            schema=schema_name,
            table=table_name,
            pk=pk,
            preview=preview,
        )
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
            select_columns=params.get("columns"),
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


class RowMutationView(APIView):
    """POST /api/connections/{id}/rows/ - insert, update, or delete rows with confirmation (PRD §12)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Mutate row(s)",
        description="Perform safe insert, update, delete, or bulk delete on table rows by primary key.",
        request=RowMutationRequestSerializer,
        responses={200: RowMutationResponseSerializer},
    )
    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        serializer = RowMutationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        default_schema = "public" if connection.engine == Connection.Engine.POSTGRES else connection.db_name
        schema_name = (validated.get("schema") or default_schema).strip()
        table_name = validated["table"].strip()

        payload = execute_row_mutation(
            connection=connection,
            user=request.user,
            action=validated["action"],
            schema=schema_name,
            table=table_name,
            data=validated.get("data"),
            pk=validated.get("pk"),
            pks=validated.get("pks"),
            preview=validated.get("preview", False),
        )
        return Response(payload, status=status.HTTP_200_OK)


class TableBrowseExportView(BaseStreamingExportView):
    """GET /api/connections/{connection_id}/tables/{table}/export/ - stream filtered table export."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Stream filtered table export",
        description="Stream filtered and sorted table rows directly as CSV, JSON, or JSONL.",
        parameters=[
            OpenApiParameter("format", str, description="Export format: 'csv', 'json', or 'jsonl' (default 'csv')."),
            OpenApiParameter("schema", str, description="Database schema name."),
            OpenApiParameter("search", str, description="Search term across text columns."),
            OpenApiParameter("sort", str, description="Column to sort by (prefix '-' for descending)."),
            OpenApiParameter("max_rows", int, description="Max rows to stream."),
        ],
    )
    def get(self, request, connection_id, table_ref=None, schema=None, table=None):
        connection = _get_connection(request, connection_id)
        schema_name, table_name, columns = _resolve_table_and_columns(
            connection, table_ref=table_ref, schema=schema, table=table
        )

        param_serializer = ExportQueryParamsSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)
        export_params = param_serializer.validated_data

        export_format = export_params.get("format", "csv")
        filename = export_params.get("filename") or f"{table_name}_export"
        max_rows = export_params.get("max_rows")

        filters = []
        raw_filters = request.query_params.get("filters")
        if raw_filters:
            try:
                parsed = json.loads(raw_filters)
                if isinstance(parsed, list):
                    filters = parsed
            except Exception:
                pass

        sort_field = request.query_params.get("sort") or None
        search_term = request.query_params.get("search") or None

        builder = BrowseQueryBuilder(
            dialect=connection.engine,
            schema=schema_name,
            table=table_name,
            columns=columns,
            filters=filters,
            search=search_term,
            sort=sort_field,
            page=1,
            page_size=max_rows or 50000,
        )
        sql, params = builder.build()

        config = config_from_connection(connection)
        driver = get_driver(config)

        return build_streaming_export_response(
            driver=driver,
            sql=sql,
            params=params,
            export_format=export_format,
            filename=filename,
            max_rows=max_rows,
        )


class StagedMutationsView(APIView):
    """POST /api/connections/{id}/staged-mutations/ - batch commit or dry-run staged grid edits."""

    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        staged_items = request.data.get("staged_items", [])
        preview = bool(request.data.get("preview", False))

        payload = execute_staged_mutations(
            connection=connection,
            user=request.user,
            staged_items=staged_items,
            preview=preview,
        )
        return Response(payload, status=status.HTTP_200_OK)


