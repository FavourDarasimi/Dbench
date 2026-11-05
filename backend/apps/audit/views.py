from __future__ import annotations

import csv
import json
import uuid
from typing import Generator

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.factory import get_driver

from .models import AuditLog, ChangeRequest
from .serializers import (
    AuditLogSerializer,
    ChangeRequestReviewSerializer,
    ChangeRequestSerializer,
    DryRunRequestSerializer,
)
from .services import (
    approve_and_execute_request,
    execute_undo,
    reject_change_request,
)


def _get_connection(request, connection_id: str | uuid.UUID) -> Connection:
    try:
        return Connection.objects.get(pk=connection_id, owner=request.user)
    except Connection.DoesNotExist:
        # Also allow staff/admin or peer team members to view connection change requests
        try:
            return Connection.objects.get(pk=connection_id)
        except Connection.DoesNotExist:
            raise NotFound("Connection not found.")


class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        qs = AuditLog.objects.filter(connection=connection).select_related("user", "undone_by")

        # Filters
        table = request.query_params.get("table")
        if table:
            qs = qs.filter(table_name=table)
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(sql__icontains=search)

        limit = min(int(request.query_params.get("limit", 50)), 200)
        offset = max(int(request.query_params.get("offset", 0)), 0)

        total_count = qs.count()
        entries = qs[offset : offset + limit]

        serializer = AuditLogSerializer(entries, many=True)
        return Response({
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "results": serializer.data,
        })


class AuditLogExportView(APIView):
    permission_classes = [IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        renderers = self.get_renderers()
        return renderers[0], renderers[0].media_type

    def get(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        export_format = request.query_params.get("format", "csv").lower()
        qs = AuditLog.objects.filter(connection=connection).select_related("user").order_by("-created_at")

        if export_format == "json":
            def json_generator() -> Generator[str, None, None]:
                yield "[\n"
                first = True
                for item in qs.iterator(chunk_size=500):
                    data = AuditLogSerializer(item).data
                    line = json.dumps(data, default=str)
                    if not first:
                        yield ",\n"
                    yield f"  {line}"
                    first = False
                yield "\n]\n"

            filename = f"audit_log_{connection.name}_{connection_id}.json"
            response = StreamingHttpResponse(json_generator(), content_type="application/json")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        # Default CSV export
        def csv_generator() -> Generator[str, None, None]:
            import io
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                "Timestamp",
                "Action",
                "User",
                "Schema",
                "Table",
                "Primary Key",
                "Rows Affected",
                "SQL",
                "Reversible",
            ])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

            for item in qs.iterator(chunk_size=500):
                writer.writerow([
                    item.created_at.isoformat(),
                    item.action,
                    item.user.email if item.user else "System",
                    item.schema_name,
                    item.table_name,
                    item.record_pk,
                    item.rows_affected,
                    item.sql.replace("\n", " "),
                    "Yes" if item.reversible else "No",
                ])
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate(0)

        filename = f"audit_log_{connection.name}_{connection_id}.csv"
        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class AuditLogUndoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, audit_id):
        try:
            audit_entry = AuditLog.objects.select_related("connection").get(pk=audit_id)
        except AuditLog.DoesNotExist:
            raise NotFound("Audit entry not found.")

        # Permission check: must be connection owner or admin
        if audit_entry.connection.owner != request.user and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to undo changes on this connection.")

        updated_entry = execute_undo(audit_id, request.user)
        return Response({
            "message": f"Successfully reverted {updated_entry.action} on {updated_entry.schema_name}.{updated_entry.table_name}.",
            "audit_entry": AuditLogSerializer(updated_entry).data,
        })


class ChangeRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        status_filter = request.query_params.get("status")

        qs = ChangeRequest.objects.filter(connection=connection).select_related("requester", "reviewer")
        if status_filter:
            qs = qs.filter(status=status_filter)

        serializer = ChangeRequestSerializer(qs[:100], many=True)
        return Response(serializer.data)


class ChangeRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, req_id):
        try:
            req = ChangeRequest.objects.select_related("connection", "requester", "reviewer").get(pk=req_id)
        except ChangeRequest.DoesNotExist:
            raise NotFound("Change request not found.")

        serializer = ChangeRequestSerializer(req)
        return Response(serializer.data)


class ChangeRequestApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, req_id):
        try:
            req = ChangeRequest.objects.select_related("connection", "requester").get(pk=req_id)
        except ChangeRequest.DoesNotExist:
            raise NotFound("Change request not found.")

        res = approve_and_execute_request(req, request.user)
        return Response(res, status=status.HTTP_200_OK)


class ChangeRequestRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, req_id):
        try:
            req = ChangeRequest.objects.select_related("connection", "requester").get(pk=req_id)
        except ChangeRequest.DoesNotExist:
            raise NotFound("Change request not found.")

        serializer = ChangeRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data.get("comment", "")

        rejected = reject_change_request(req, request.user, comment=comment)
        return Response({
            "message": f"Change request #{rejected.id} was rejected.",
            "status": rejected.status,
        })


class DryRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        connection = _get_connection(request, connection_id)
        serializer = DryRunRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sql = data["sql"].strip()
        params = data.get("params")
        timeout = data.get("timeout", 30)

        driver = get_driver(config_from_connection(connection))
        try:
            dry_run = driver.execute_dry_run(sql, params, timeout=timeout)
            return Response(dry_run.to_dict(), status=status.HTTP_200_OK)
        finally:
            driver.close()
