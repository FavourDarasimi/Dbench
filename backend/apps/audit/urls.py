from django.urls import path
from .views import (
    AuditLogExportView,
    AuditLogListView,
    AuditLogUndoView,
    ChangeRequestApproveView,
    ChangeRequestDetailView,
    ChangeRequestListView,
    ChangeRequestRejectView,
    DryRunView,
)

urlpatterns = [
    # Audit Logs
    path("connections/<uuid:connection_id>/audit/", AuditLogListView.as_view(), name="audit-list"),
    path("connections/<uuid:connection_id>/audit/export/", AuditLogExportView.as_view(), name="audit-export"),
    path("audit/<uuid:audit_id>/undo/", AuditLogUndoView.as_view(), name="audit-undo"),

    # Change Requests (Approvals)
    path("connections/<uuid:connection_id>/change-requests/", ChangeRequestListView.as_view(), name="change-request-list"),
    path("change-requests/<uuid:req_id>/", ChangeRequestDetailView.as_view(), name="change-request-detail"),
    path("change-requests/<uuid:req_id>/approve/", ChangeRequestApproveView.as_view(), name="change-request-approve"),
    path("change-requests/<uuid:req_id>/reject/", ChangeRequestRejectView.as_view(), name="change-request-reject"),

    # Dry-Run Impact Preview
    path("connections/<uuid:connection_id>/dry-run/", DryRunView.as_view(), name="dry-run"),
]
