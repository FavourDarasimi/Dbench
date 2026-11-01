from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .client import get_pusher_client
from .serializers import PusherAuthRequestSerializer, PusherAuthResponseSerializer

logger = logging.getLogger(__name__)


class PusherAuthView(APIView):
    """POST /api/pusher/auth/ - Authorize private channels (Pusher protocol, PRD F14)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @extend_schema(
        summary="Authorize Pusher / Soketi private channel",
        description=(
            "Validates user identity and generates an HMAC subscription signature "
            "for private channels such as private-user-{id}."
        ),
        request=PusherAuthRequestSerializer,
        responses={
            200: PusherAuthResponseSerializer,
            400: dict,
            403: dict,
            503: dict,
        },
    )
    def post(self, request):
        serializer = PusherAuthRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        socket_id = serializer.validated_data["socket_id"]
        channel_name = serializer.validated_data["channel_name"]

        # 1. Authorize channel access
        if channel_name.startswith("private-user-"):
            target_user_id = channel_name.removeprefix("private-user-")
            if target_user_id != str(request.user.id):
                raise PermissionDenied(
                    "You are not authorized to subscribe to another user's channel."
                )
        elif channel_name.startswith("presence-user-"):
            target_user_id = channel_name.removeprefix("presence-user-")
            if target_user_id != str(request.user.id):
                raise PermissionDenied(
                    "You are not authorized to subscribe to another user's presence channel."
                )
        else:
            raise PermissionDenied(
                f"Unauthorized subscription attempt to channel '{channel_name}'."
            )

        # 2. Get Pusher client
        client = get_pusher_client()
        if client is None:
            return Response(
                {"detail": "Real-time notification service is currently unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 3. Generate auth signature
        try:
            if channel_name.startswith("presence-"):
                custom_data = {
                    "user_id": str(request.user.id),
                    "user_info": {
                        "email": request.user.email,
                    },
                }
                auth_payload = client.authenticate(
                    channel=channel_name,
                    socket_id=socket_id,
                    custom_data=custom_data,
                )
            else:
                auth_payload = client.authenticate(
                    channel=channel_name,
                    socket_id=socket_id,
                )

            return Response(auth_payload, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.error("Pusher authentication signature generation failed: %s", exc)
            return Response(
                {"detail": "Failed to generate channel authentication signature."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
