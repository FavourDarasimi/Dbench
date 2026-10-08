from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound

from .models import Connection
from .serializers import ConnectionSerializer, ConnectionTestSerializer
from .services import config_from_connection, run_connection_test


class ConnectionViewSet(viewsets.ModelViewSet):
    serializer_class = ConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Connection.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ConnectionTestDraftView(APIView):
    """POST /api/connections/test/ - test an unsaved connection draft."""

    def post(self, request):
        serializer = ConnectionTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(run_connection_test(serializer.to_config()))


class ConnectionTestSavedView(APIView):
    """POST /api/connections/{id}/test/ - test a stored connection."""

    def post(self, request, pk):
        try:
            connection = Connection.objects.get(pk=pk, owner=request.user)
        except (Connection.DoesNotExist, ValueError):
            raise NotFound("Connection not found.")
        try:
            config = config_from_connection(connection)
        except ValueError as exc:
            return Response({"ok": False, "error": str(exc), "latency_ms": None, "server_version": None})
        return Response(run_connection_test(config))
