from __future__ import annotations

from rest_framework import serializers

from apps.connections.models import Connection
from apps.explorer.serializers import ColumnSerializer
from .models import QueryHistory, SavedQuery


class ExecuteQueryRequestSerializer(serializers.Serializer):
    sql = serializers.CharField(required=True, allow_blank=False)
    params = serializers.ListField(required=False, default=list)
    limit = serializers.IntegerField(required=False, default=1000, min_value=1, max_value=10000)
    timeout = serializers.IntegerField(required=False, default=30, min_value=1, max_value=120)
    confirm_destructive = serializers.BooleanField(required=False, default=False)
    source = serializers.ChoiceField(
        choices=QueryHistory.Source.choices, required=False, default=QueryHistory.Source.EDITOR
    )


class ExecuteQueryResponseSerializer(serializers.Serializer):
    run_id = serializers.UUIDField()
    columns = ColumnSerializer(many=True)
    column_names = serializers.ListField(child=serializers.CharField())
    rows = serializers.ListField(child=serializers.DictField())
    row_count = serializers.IntegerField()
    duration_ms = serializers.IntegerField()
    truncated = serializers.BooleanField()


class DestructiveWarningResponseSerializer(serializers.Serializer):
    requires_confirmation = serializers.BooleanField(default=True)
    warnings = serializers.ListField(child=serializers.CharField())
    message = serializers.CharField()


class QueryCancelResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    message = serializers.CharField()


class QueryHistorySerializer(serializers.ModelSerializer):
    connection_name = serializers.CharField(source="connection.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = QueryHistory
        fields = [
            "id",
            "connection",
            "connection_name",
            "user",
            "user_email",
            "sql",
            "status",
            "duration_ms",
            "row_count",
            "source",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields


class SavedQuerySerializer(serializers.ModelSerializer):
    connection_name = serializers.CharField(source="connection.name", read_only=True)

    class Meta:
        model = SavedQuery
        fields = [
            "id",
            "connection",
            "connection_name",
            "title",
            "sql",
            "tags",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_connection(self, value):
        if value is not None and value.owner != self.context["request"].user:
            raise serializers.ValidationError("You can only associate saved queries with your own connections.")
        return value

    def create(self, validated_data):
        validated_data.setdefault("owner", self.context["request"].user)
        return SavedQuery.objects.create(**validated_data)
