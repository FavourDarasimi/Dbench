from __future__ import annotations

import json
from typing import Any
from rest_framework import serializers

from apps.explorer.serializers import ColumnSerializer


class BrowseRequestSerializer(serializers.Serializer):
    page = serializers.IntegerField(required=False, default=1, min_value=1)
    page_size = serializers.IntegerField(required=False, default=50, min_value=1, max_value=500)
    sort = serializers.CharField(required=False, allow_blank=True, default="")
    filters = serializers.CharField(required=False, allow_blank=True, default="")
    search = serializers.CharField(required=False, allow_blank=True, default="")
    cursor = serializers.CharField(required=False, allow_blank=True, default="")

    def to_parsed_params(self) -> dict[str, Any]:
        data = dict(self.validated_data)
        filters_raw = data.get("filters", "")
        if isinstance(filters_raw, str) and filters_raw.strip():
            try:
                data["filters"] = json.loads(filters_raw)
            except Exception:
                data["filters"] = []
        elif not isinstance(filters_raw, list):
            data["filters"] = []

        cursor_raw = data.get("cursor", "")
        if isinstance(cursor_raw, str) and cursor_raw.strip():
            try:
                data["cursor"] = json.loads(cursor_raw)
            except Exception:
                data["cursor"] = None
        elif not isinstance(cursor_raw, dict):
            data["cursor"] = None

        return data


class BrowseResponseSerializer(serializers.Serializer):
    schema = serializers.CharField()
    table = serializers.CharField()
    columns = ColumnSerializer(many=True)
    rows = serializers.ListField(child=serializers.DictField())
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    row_count = serializers.IntegerField()
    total_rows = serializers.IntegerField(allow_null=True)
    duration_ms = serializers.IntegerField()
    has_more = serializers.BooleanField()


class RowCountResponseSerializer(serializers.Serializer):
    schema = serializers.CharField()
    table = serializers.CharField()
    count = serializers.IntegerField()
    is_exact = serializers.BooleanField()


class SqlPreviewResponseSerializer(serializers.Serializer):
    sql = serializers.CharField()
    raw_sql = serializers.CharField()
    params = serializers.ListField(child=serializers.CharField())


class RelatedCountSerializer(serializers.Serializer):
    schema = serializers.CharField()
    table = serializers.CharField()
    column = serializers.CharField()
    count = serializers.IntegerField()


class RowDetailResponseSerializer(serializers.Serializer):
    row = serializers.DictField()
    pk_column = serializers.CharField()
    pk_value = serializers.CharField()
    columns = ColumnSerializer(many=True)
    related = RelatedCountSerializer(many=True)
