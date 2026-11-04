from django.contrib import admin

from .models import QueryHistory, SavedQuery


@admin.register(QueryHistory)
class QueryHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "connection",
        "status",
        "source",
        "duration_ms",
        "row_count",
        "created_at",
    )
    list_filter = ("status", "source", "connection__engine", "created_at")
    search_fields = (
        "sql",
        "user__email",
        "connection__name",
        "error_message",
    )
    readonly_fields = (
        "id",
        "user",
        "connection",
        "sql",
        "status",
        "duration_ms",
        "row_count",
        "source",
        "error_message",
        "created_at",
    )
    date_hierarchy = "created_at"


@admin.register(SavedQuery)
class SavedQueryAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "owner",
        "connection",
        "updated_at",
        "created_at",
    )
    list_filter = ("connection__engine", "updated_at", "created_at")
    search_fields = (
        "title",
        "sql",
        "owner__email",
        "connection__name",
    )
    readonly_fields = ("id", "created_at", "updated_at")
