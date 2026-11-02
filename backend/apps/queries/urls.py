from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CancelQueryView,
    ExecuteQueryView,
    QueryDirectExportView,
    QueryExportByRunIdView,
    QueryHistoryViewSet,
    SavedQueryViewSet,
)

router = DefaultRouter()
router.register(r"history", QueryHistoryViewSet, basename="history")
router.register(r"saved-queries", SavedQueryViewSet, basename="saved-query")

urlpatterns = [
    path("connections/<uuid:connection_id>/query/", ExecuteQueryView.as_view(), name="connection-query"),
    path(
        "connections/<uuid:connection_id>/query/<str:run_id>/export/",
        QueryExportByRunIdView.as_view(),
        name="connection-query-export",
    ),
    path(
        "connections/<uuid:connection_id>/query/export/",
        QueryDirectExportView.as_view(),
        name="connection-direct-query-export",
    ),
    path(
        "connections/<uuid:connection_id>/export/",
        QueryDirectExportView.as_view(),
        name="connection-direct-export",
    ),
    path("queries/<str:run_id>/cancel/", CancelQueryView.as_view(), name="query-cancel"),
    path("", include(router.urls)),
]
