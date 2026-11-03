from __future__ import annotations

import logging
import uuid
from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.base import (
    DriverAuthenticationError,
    DriverCancelledError,
    DriverConnectionError,
    DriverError,
    DriverQueryError,
    DriverReadOnlyError,
    DriverTimeoutError,
)
from apps.drivers.factory import get_driver
from apps.drivers.pool import run_tracker
from apps.notifications.events import (
    notify_query_cancelled,
    notify_query_completed,
    notify_query_failed,
    notify_query_started,
)

from .export import build_streaming_export_response
from .models import QueryHistory, SavedQuery
from .safety import analyze_sql_safety, is_mutation_statement
from .serializers import (
    DestructiveWarningResponseSerializer,
    DirectExportRequestSerializer,
    ExecuteQueryRequestSerializer,
    ExecuteQueryResponseSerializer,
    ExportQueryParamsSerializer,
    QueryCancelResponseSerializer,
    QueryHistorySerializer,
    SavedQuerySerializer,
)

logger = logging.getLogger(__name__)


def _get_connection(request, connection_id) -> Connection:
    try:
        return Connection.objects.get(pk=connection_id, owner=request.user)
    except (Connection.DoesNotExist, ValueError):
        raise NotFound("Connection not found.")


class ExecuteQueryView(APIView):
    """POST /api/connections/{id}/query/ - execute SQL with safety checks, timeout, and limits."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Execute SQL query",
        description="Run arbitrary SQL query under statement timeout and row limit constraints.",
        request=ExecuteQueryRequestSerializer,
        responses={
            200: ExecuteQueryResponseSerializer,
            422: DestructiveWarningResponseSerializer,
        },
    )
    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        serializer = ExecuteQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sql: str = data["sql"].strip()
        params = data.get("params") or None
        limit: int = data.get("limit", 1000)
        timeout: int = data.get("timeout", 30)
        confirm_destructive: bool = data.get("confirm_destructive", False)
        source: str = data.get("source", QueryHistory.Source.EDITOR)

        # 1. Read-only fast-path rejection
        if connection.read_only and is_mutation_statement(sql, connection.engine):
            err_msg = "Connection is in read-only mode. Modifying operations are blocked."
            QueryHistory.objects.create(
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.BLOCKED,
                duration_ms=0,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            return Response({"detail": err_msg}, status=status.HTTP_403_FORBIDDEN)

        # 2. Destructive SQL safety checks (PRD F6)
        warnings = analyze_sql_safety(sql, dialect=connection.engine)
        if warnings and not confirm_destructive:
            return Response(
                {
                    "requires_confirmation": True,
                    "warnings": warnings,
                    "message": "Destructive statement detected. Confirmation required before execution.",
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # 3. Execution setup
        run_id = str(uuid.uuid4())
        config = config_from_connection(connection)
        driver = get_driver(config)

        notify_query_started(
            user_id=request.user.id,
            run_id=run_id,
            connection_id=str(connection.id),
            sql=sql,
            database=connection.db_name,
        )

        try:
            result = driver.execute(
                sql=sql,
                params=params,
                limit=limit,
                timeout=timeout,
                run_id=run_id,
            )

            # Record successful run in history
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.SUCCESS,
                duration_ms=result.duration_ms,
                row_count=result.row_count,
                source=source,
            )

            notify_query_completed(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
                duration_ms=result.duration_ms,
                row_count=result.row_count,
            )

            payload = {"run_id": run_id, **result.to_dict()}
            return Response(payload, status=status.HTTP_200_OK)

        except DriverReadOnlyError as exc:
            err_msg = str(exc)
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.BLOCKED,
                duration_ms=0,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            notify_query_failed(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
                duration_ms=0,
                error=err_msg,
                status="blocked",
            )
            return Response({"detail": err_msg, "run_id": run_id}, status=status.HTTP_403_FORBIDDEN)

        except DriverTimeoutError as exc:
            err_msg = str(exc)
            duration_ms = int(timeout * 1000)
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.TIMEOUT,
                duration_ms=duration_ms,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            notify_query_failed(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
                duration_ms=duration_ms,
                error=err_msg,
                status="timeout",
            )
            return Response({"detail": err_msg, "run_id": run_id}, status=status.HTTP_408_REQUEST_TIMEOUT)

        except DriverCancelledError as exc:
            err_msg = str(exc)
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.CANCELLED,
                duration_ms=0,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            notify_query_cancelled(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
            )
            return Response({"detail": "Query was cancelled.", "run_id": run_id}, status=499)

        except (DriverConnectionError, DriverAuthenticationError) as exc:
            err_msg = str(exc)
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.FAILED,
                duration_ms=0,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            notify_query_failed(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
                duration_ms=0,
                error=err_msg,
                status="failed",
            )
            return Response({"detail": err_msg, "run_id": run_id}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        except (DriverQueryError, DriverError, Exception) as exc:
            err_msg = str(exc)
            QueryHistory.objects.create(
                id=uuid.UUID(run_id),
                user=request.user,
                connection=connection,
                sql=sql,
                status=QueryHistory.Status.FAILED,
                duration_ms=0,
                row_count=0,
                source=source,
                error_message=err_msg,
            )
            notify_query_failed(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(connection.id),
                duration_ms=0,
                error=err_msg,
                status="failed",
            )
            return Response({"detail": err_msg, "run_id": run_id}, status=status.HTTP_400_BAD_REQUEST)

        finally:
            driver.close()


class CancelQueryView(APIView):
    """POST /api/queries/{run_id}/cancel/ - cancel an in-flight query execution (PRD F5)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Cancel running query",
        description="Cancel a currently executing SQL query given its run_id.",
        request=None,
        responses={200: QueryCancelResponseSerializer},
    )
    def post(self, request, run_id):
        run_info = run_tracker.get(run_id)
        if not run_info:
            return Response(
                {"ok": False, "message": "Query run_id not found or has already completed."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check connection ownership if connection_id was recorded
        if run_info.connection_id:
            if not Connection.objects.filter(pk=run_info.connection_id, owner=request.user).exists():
                raise PermissionDenied("You do not have permission to cancel this query.")

        # Delegate to driver cancel
        driver = run_info.driver
        cancelled = False
        if driver is not None:
            try:
                cancelled = driver.cancel(run_id)
            except Exception as exc:
                logger.warning("Error cancelling query %s via driver: %s", run_id, exc)

        if not cancelled and run_info.connection_id:
            try:
                conn = Connection.objects.get(pk=run_info.connection_id)
                fallback_driver = get_driver(config_from_connection(conn))
                cancelled = fallback_driver.cancel(run_id)
                fallback_driver.close()
            except Exception as exc:
                logger.warning("Fallback cancel failed for query %s: %s", run_id, exc)

        if run_info.connection_id:
            notify_query_cancelled(
                user_id=request.user.id,
                run_id=run_id,
                connection_id=str(run_info.connection_id),
            )

        return Response(
            {"ok": True, "message": "Cancellation request delivered to database engine."},
            status=status.HTTP_200_OK,
        )


class QueryHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/history/ - list query execution history."""

    serializer_class = QueryHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = QueryHistory.objects.filter(user=self.request.user).select_related("connection", "user")
        conn_id = self.request.query_params.get("connection_id")
        if conn_id:
            qs = qs.filter(connection_id=conn_id)
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs[:100]  # Cap history list to latest 100 entries


class SavedQueryViewSet(viewsets.ModelViewSet):
    """CRUD /api/saved-queries/ - manage saved queries and snippets."""

    serializer_class = SavedQuerySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SavedQuery.objects.filter(owner=self.request.user).select_related("connection")
        conn_id = self.request.query_params.get("connection_id")
        if conn_id:
            qs = qs.filter(connection_id=conn_id)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__contains=[tag])
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class BaseStreamingExportView(APIView):
    """Bypasses DRF format-suffix negotiation for streamed custom files (CSV, JSONL, etc.)."""

    def perform_content_negotiation(self, request, force=False):
        renderers = self.get_renderers()
        return renderers[0], renderers[0].media_type


class QueryExportByRunIdView(BaseStreamingExportView):
    """GET /api/connections/{connection_id}/query/{run_id}/export/ - stream export of executed query (PRD F8)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Stream query results export by run ID",
        description="Stream the results of an executed query as CSV, JSON, or JSONL with minimal memory overhead.",
        parameters=[
            OpenApiParameter("format", str, description="Export format: 'csv', 'json', or 'jsonl' (default 'csv')."),
            OpenApiParameter("filename", str, description="Custom filename without extension."),
            OpenApiParameter("max_rows", int, description="Max rows to stream."),
        ],
    )
    def get(self, request, connection_id, run_id):
        connection = _get_connection(request, connection_id)
        param_serializer = ExportQueryParamsSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)
        params_data = param_serializer.validated_data

        export_format = params_data.get("format", "csv")
        filename = params_data.get("filename") or f"export_{str(run_id)[:8]}"
        max_rows = params_data.get("max_rows")

        try:
            run_uuid = uuid.UUID(run_id) if isinstance(run_id, str) else run_id
            query_record = QueryHistory.objects.get(
                id=run_uuid,
                connection=connection,
                user=request.user,
            )
        except (QueryHistory.DoesNotExist, ValueError):
            raise NotFound("Query execution history record not found.")

        config = config_from_connection(connection)
        driver = get_driver(config)

        return build_streaming_export_response(
            driver=driver,
            sql=query_record.sql,
            export_format=export_format,
            filename=filename,
            max_rows=max_rows,
        )


class QueryDirectExportView(BaseStreamingExportView):
    """POST /api/connections/{connection_id}/query/export/ - stream arbitrary SQL query export directly."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Stream arbitrary SQL query export",
        description="Execute an arbitrary SQL query and stream its results directly as CSV or JSON.",
        request=DirectExportRequestSerializer,
    )
    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        serializer = DirectExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sql = data["sql"].strip()
        params = data.get("params") or None
        export_format = data.get("format", "csv")
        filename = data.get("filename") or f"export_{connection.name.lower()}"
        max_rows = data.get("max_rows")

        # Fast-path check: block mutating SQL on read-only connection
        if connection.read_only and is_mutation_statement(sql, connection.engine):
            return Response(
                {"detail": "Connection is in read-only mode. Modifying operations are blocked."},
                status=status.HTTP_403_FORBIDDEN,
            )

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
