from django.urls import path

from .views import PusherAuthView

urlpatterns = [
    path("pusher/auth/", PusherAuthView.as_view(), name="pusher-auth"),
]
