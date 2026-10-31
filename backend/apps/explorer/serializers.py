from __future__ import annotations

from rest_framework import serializers


class ForeignKeySerializer(serializers.Serializer):
    target_schema = serializers.CharField()
    target_table = serializers.CharField()
    target_column = serializers.CharField()
    constraint_name = serializers.CharField(allow_null=True, required=False)


class ColumnSerializer(serializers.Serializer):
    name = serializers.CharField()
    data_type = serializers.CharField()
    generic_type = serializers.CharField()
    nullable = serializers.BooleanField(default=True)
    default = serializers.CharField(allow_null=True, required=False)
    is_primary_key = serializers.BooleanField(default=False)
    foreign_key = ForeignKeySerializer(allow_null=True, required=False)


class TableSerializer(serializers.Serializer):
    name = serializers.CharField()
    schema = serializers.CharField()
    type = serializers.CharField()
    row_count_estimate = serializers.IntegerField(allow_null=True, required=False)
    comment = serializers.CharField(allow_null=True, required=False)


class SchemaTreeItemSerializer(serializers.Serializer):
    schema = serializers.CharField()
    tables = TableSerializer(many=True)


class RefreshSchemaResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    message = serializers.CharField()
