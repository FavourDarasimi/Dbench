from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.connections.views import (
    ConnectionTestDraftView,
    ConnectionTestSavedView,
    ConnectionViewSet,
)
from config.views import HealthView

router = DefaultRouter()
router.register(r"connections", ConnectionViewSet, basename="connection")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view()),
    path("api/auth/", include("apps.accounts.urls")),
    # Explicit paths are registered before the router so that
    # POST /api/connections/test/ can never collide with the router's
    # /api/connections/{pk}/ detail route.
    path("api/connections/test/", ConnectionTestDraftView.as_view()),
    path("api/connections/<uuid:pk>/test/", ConnectionTestSavedView.as_view()),
    path("api/", include(router.urls)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
