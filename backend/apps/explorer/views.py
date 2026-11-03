from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.connections.models import Connection
from apps.notifications.events import notify_schema_updated
from .serializers import (
    ColumnSerializer,
    ERDResponseSerializer,
    RefreshSchemaResponseSerializer,
    SchemaTreeItemSerializer,
    TableSerializer,
)
from .services import schema_cache


def _get_connection(request, connection_id) -> Connection:
    try:
        return Connection.objects.get(pk=connection_id, owner=request.user)
    except (Connection.DoesNotExist, ValueError):
        raise NotFound("Connection not found.")


class ConnectionSchemasView(APIView):
    """GET /api/connections/{id}/schemas/ - list database schemas."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List schemas",
        description="List non-system schemas in the target database.",
        responses={200: {"type": "object", "properties": {"schemas": {"type": "array", "items": {"type": "string"}}}}},
    )
    def get(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        force_refresh = request.query_params.get("refresh", "").lower() in ("1", "true")
        schemas = schema_cache.get_schemas(connection, force_refresh=force_refresh)
        return Response({"schemas": schemas})


class ConnectionTablesView(APIView):
    """GET /api/connections/{id}/schemas/{schema}/tables/ - list tables and views in schema."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List tables",
        description="List tables and views in a specific schema with row count estimates.",
        responses={200: TableSerializer(many=True)},
    )
    def get(self, request, connection_id, schema):
        connection = _get_connection(request, connection_id)
        force_refresh = request.query_params.get("refresh", "").lower() in ("1", "true")
        tables = schema_cache.get_tables(connection, schema=schema, force_refresh=force_refresh)
        return Response({"schema": schema, "tables": tables})


class ConnectionColumnsView(APIView):
    """
    GET /api/connections/{id}/schemas/{schema}/tables/{table}/columns/
    or
    GET /api/connections/{id}/tables/{table_ref}/columns/
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Describe table columns",
        description="Introspect columns, data types, primary keys, and foreign keys for a table.",
        responses={200: ColumnSerializer(many=True)},
    )
    def get(self, request, connection_id, schema=None, table=None, table_ref=None):
        connection = _get_connection(request, connection_id)
        force_refresh = request.query_params.get("refresh", "").lower() in ("1", "true")

        if table_ref:
            if "." in table_ref:
                schema_name, table_name = table_ref.split(".", 1)
            else:
                schema_name = "public" if connection.engine == Connection.Engine.POSTGRES else connection.db_name
                table_name = table_ref
        else:
            schema_name = schema or "public"
            table_name = table

        columns = schema_cache.get_columns(
            connection, schema=schema_name, table=table_name, force_refresh=force_refresh
        )
        return Response({"schema": schema_name, "table": table_name, "columns": columns})


class ConnectionSchemaTreeView(APIView):
    """GET /api/connections/{id}/schema-tree/ - complete lazy-ready tree of schemas and tables."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get schema tree",
        description="Retrieve a nested hierarchy of schemas and their tables.",
        responses={200: SchemaTreeItemSerializer(many=True)},
    )
    def get(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        force_refresh = request.query_params.get("refresh", "").lower() in ("1", "true")
        tree = schema_cache.get_schema_tree(connection, force_refresh=force_refresh)
        return Response({"tree": tree})


class ConnectionRefreshSchemaView(APIView):
    """POST /api/connections/{id}/refresh-schema/ - invalidate metadata cache."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Refresh schema cache",
        description="Clear cached schema, table, and column metadata for this connection.",
        request=None,
        responses={200: RefreshSchemaResponseSerializer},
    )
    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        schema_cache.invalidate_connection(str(connection.id))
        notify_schema_updated(user_id=request.user.id, connection_id=str(connection.id))
        return Response(
            {"status": "ok", "message": f"Schema cache for '{connection.name}' cleared successfully."},
            status=status.HTTP_200_OK,
        )


class ConnectionERDView(APIView):
    """
    GET /api/connections/{id}/erd/?schema=public
    or
    GET /api/connections/{id}/schemas/{schema}/erd/
    
    Returns complete tables (columns, data types, PKs) and relations for interactive ER diagrams.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Schema ERD",
        description="Retrieve complete tables, columns, primary keys, and foreign key relations for ER diagrams.",
        parameters=[
            OpenApiParameter("schema", str, description="Schema name (defaults to public or db_name)"),
            OpenApiParameter("refresh", bool, description="Force refresh cache"),
        ],
        responses={200: ERDResponseSerializer},
    )
    def get(self, request, connection_id, schema=None):
        connection = _get_connection(request, connection_id)
        target_schema = schema or request.query_params.get("schema")
        if not target_schema:
            target_schema = "public" if connection.engine == Connection.Engine.POSTGRES else connection.db_name

        force_refresh = request.query_params.get("refresh", "").lower() in ("1", "true")
        erd_data = schema_cache.get_erd(connection, schema=target_schema, force_refresh=force_refresh)
        return Response(erd_data)

