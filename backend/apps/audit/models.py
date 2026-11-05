from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        INSERT = "insert", "Insert"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        BULK_DELETE = "bulk_delete", "Bulk Delete"
        RAW_SQL = "raw_sql", "Raw SQL"
        BATCH_MUTATION = "batch_mutation", "Batch Mutation"
        UNDO = "undo", "Undo"

    class Source(models.TextChoices):
        BROWSER = "browser", "Browser"
        EDITOR = "editor", "Editor"
        STAGING = "staging", "Staging"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    connection = models.ForeignKey(
        "connections.Connection",
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    schema_name = models.CharField(max_length=120, blank=True, default="")
    table_name = models.CharField(max_length=120, blank=True, default="")
    record_pk = models.CharField(max_length=255, blank=True, default="")
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    diff = models.JSONField(null=True, blank=True)
    sql = models.TextField(blank=True, default="")
    rows_affected = models.PositiveIntegerField(default=1)
    reversible = models.BooleanField(default=False)
    undone_at = models.DateTimeField(null=True, blank=True)
    undone_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="undone_audits",
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.BROWSER)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["connection", "-created_at"]),
            models.Index(fields=["table_name", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        user_email = self.user.email if self.user else "System"
        return f"[{self.action.upper()}] {self.schema_name}.{self.table_name} by {user_email} at {self.created_at}"


class ChangeRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        EXECUTED = "executed", "Executed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    connection = models.ForeignKey(
        "connections.Connection",
        on_delete=models.CASCADE,
        related_name="change_requests",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_changes",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_changes",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    action = models.CharField(max_length=32, default="update")
    schema_name = models.CharField(max_length=120, blank=True, default="")
    table_name = models.CharField(max_length=120, blank=True, default="")
    sql = models.TextField()
    params = models.JSONField(null=True, blank=True)
    staged_payload = models.JSONField(null=True, blank=True)
    impact_summary = models.JSONField(default=dict)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    review_comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["connection", "status", "-created_at"]),
            models.Index(fields=["requester", "status", "-created_at"]),
        ]

    def __str__(self):
        return f"ChangeRequest #{self.id} [{self.status}] on {self.connection.name} by {self.requester.email}"
