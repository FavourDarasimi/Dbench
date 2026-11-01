from django.urls import path

from .views import (
    BrowseRowsView,
    RowDetailView,
    RowMutationView,
    SqlPreviewView,
    TableRowCountView,
)

urlpatterns = [
    # 1. General mutation endpoint (PRD §12: POST /api/connections/{id}/rows/)
    path("connections/<uuid:connection_id>/rows/", RowMutationView.as_view(), name="browser-rows-mutate"),

    # 2. Table rows (GET to browse, POST to insert, DELETE for bulk delete)
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/rows/", BrowseRowsView.as_view(), name="browser-table-rows"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/rows/", BrowseRowsView.as_view(), name="browser-schema-table-rows"),

    # 3. Row count (estimated or exact)
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/count/", TableRowCountView.as_view(), name="browser-table-count"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/count/", TableRowCountView.as_view(), name="browser-schema-table-count"),

    # 4. Single row detail & mutations (GET detail, PATCH update, DELETE single)
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/rows/<str:pk>/", RowDetailView.as_view(), name="browser-table-row-detail"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/rows/<str:pk>/", RowDetailView.as_view(), name="browser-schema-table-row-detail"),

    # 5. Show SQL preview
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/sql-preview/", SqlPreviewView.as_view(), name="browser-table-sql-preview"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/sql-preview/", SqlPreviewView.as_view(), name="browser-schema-table-sql-preview"),
]
