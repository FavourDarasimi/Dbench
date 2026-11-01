from django.urls import path

from .views import (
    BrowseRowsView,
    RowDetailView,
    SqlPreviewView,
    TableRowCountView,
)

urlpatterns = [
    # 1. Browse rows
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/rows/", BrowseRowsView.as_view(), name="browser-table-rows"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/rows/", BrowseRowsView.as_view(), name="browser-schema-table-rows"),

    # 2. Row count (estimated or exact)
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/count/", TableRowCountView.as_view(), name="browser-table-count"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/count/", TableRowCountView.as_view(), name="browser-schema-table-count"),

    # 3. Single row detail with foreign key related counts
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/rows/<str:pk>/", RowDetailView.as_view(), name="browser-table-row-detail"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/rows/<str:pk>/", RowDetailView.as_view(), name="browser-schema-table-row-detail"),

    # 4. Show SQL preview
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/sql-preview/", SqlPreviewView.as_view(), name="browser-table-sql-preview"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/sql-preview/", SqlPreviewView.as_view(), name="browser-schema-table-sql-preview"),
]
