from __future__ import annotations

from rest_framework import serializers
from .models import AuditLog, ChangeRequest


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    undone_by_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "action",
            "schema_name",
            "table_name",
            "record_pk",
            "before_state",
            "after_state",
            "diff",
            "sql",
            "rows_affected",
            "reversible",
            "undone_at",
            "undone_by_email",
            "source",
            "user_email",
            "created_at",
        ]

    def get_user_email(self, obj: AuditLog) -> str:
        return obj.user.email if obj.user else "System"

    def get_undone_by_email(self, obj: AuditLog) -> str | None:
        return obj.undone_by.email if obj.undone_by else None


class ChangeRequestSerializer(serializers.ModelSerializer):
    requester_email = serializers.SerializerMethodField()
    reviewer_email = serializers.SerializerMethodField()
    connection_name = serializers.CharField(source="connection.name", read_only=True)

    class Meta:
        model = ChangeRequest
        fields = [
            "id",
            "connection",
            "connection_name",
            "requester_email",
            "reviewer_email",
            "title",
            "description",
            "action",
            "schema_name",
            "table_name",
            "sql",
            "impact_summary",
            "status",
            "review_comment",
            "created_at",
            "reviewed_at",
            "executed_at",
        ]

    def get_requester_email(self, obj: ChangeRequest) -> str:
        return obj.requester.email if obj.requester else "Unknown"

    def get_reviewer_email(self, obj: ChangeRequest) -> str | None:
        return obj.reviewer.email if obj.reviewer else None


class ChangeRequestReviewSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class DryRunRequestSerializer(serializers.Serializer):
    sql = serializers.CharField()
    params = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    timeout = serializers.IntegerField(default=30, min_value=1, max_value=300)
