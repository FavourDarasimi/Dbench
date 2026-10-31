from django.urls import path

from .views import (
    ConnectionColumnsView,
    ConnectionRefreshSchemaView,
    ConnectionSchemasView,
    ConnectionSchemaTreeView,
    ConnectionTablesView,
)

urlpatterns = [
    path("connections/<uuid:connection_id>/schemas/", ConnectionSchemasView.as_view(), name="connection-schemas"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/", ConnectionTablesView.as_view(), name="connection-tables"),
    path("connections/<uuid:connection_id>/schemas/<str:schema>/tables/<str:table>/columns/", ConnectionColumnsView.as_view(), name="connection-schema-table-columns"),
    path("connections/<uuid:connection_id>/tables/<str:table_ref>/columns/", ConnectionColumnsView.as_view(), name="connection-table-columns"),
    path("connections/<uuid:connection_id>/schema-tree/", ConnectionSchemaTreeView.as_view(), name="connection-schema-tree"),
    path("connections/<uuid:connection_id>/refresh-schema/", ConnectionRefreshSchemaView.as_view(), name="connection-refresh-schema"),
]
