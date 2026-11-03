from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models

from apps.connections.models import Connection


class QueryHistory(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        TIMEOUT = "timeout", "Timeout"
        BLOCKED = "blocked", "Blocked"

    class Source(models.TextChoices):
        EDITOR = "editor", "Editor"
        BROWSER = "browser", "Browser"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="query_history"
    )
    connection = models.ForeignKey(
        Connection, on_delete=models.CASCADE, related_name="query_history"
    )
    sql = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUCCESS)
    duration_ms = models.PositiveIntegerField(default=0)
    row_count = models.IntegerField(default=0)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.EDITOR)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name_plural = "query histories"
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["connection", "-created_at"]),
            models.Index(fields=["user", "connection", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.status} ({self.duration_ms}ms) [{self.created_at}]"


class SavedQuery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_queries"
    )
    connection = models.ForeignKey(
        Connection, on_delete=models.SET_NULL, null=True, blank=True, related_name="saved_queries"
    )
    title = models.CharField(max_length=200)
    sql = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        verbose_name_plural = "saved queries"
        indexes = [
            models.Index(fields=["owner", "-updated_at"]),
            models.Index(fields=["owner", "connection", "-updated_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.owner.email})"
