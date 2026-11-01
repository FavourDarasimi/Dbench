from __future__ import annotations

from rest_framework import serializers


class PusherAuthRequestSerializer(serializers.Serializer):
    """Payload sent by Pusher client (pusher-js) during channel authorization."""

    socket_id = serializers.CharField(
        max_length=100,
        required=True,
        help_text="Socket ID assigned by Soketi/Pusher server.",
    )
    channel_name = serializers.CharField(
        max_length=200,
        required=True,
        help_text="Name of the private or presence channel being authorized.",
    )


class PusherAuthResponseSerializer(serializers.Serializer):
    """Authorization signature returned to Pusher client."""

    auth = serializers.CharField(
        help_text="HMAC authentication signature for the channel subscription."
    )
    channel_data = serializers.CharField(
        required=False,
        help_text="Serialized JSON string containing presence data (for presence channels).",
    )
