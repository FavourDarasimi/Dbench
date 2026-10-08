import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _disable_throttling(settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_CLASSES": [],
    }


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user_factory(db):
    from apps.accounts.models import User

    counter = {"n": 0}

    def make(email: str | None = None, password: str = "s3cure-pass!", **extra):
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        return User.objects.create_user(email=email, password=password, **extra)

    return make


@pytest.fixture
def user(user_factory):
    return user_factory()


@pytest.fixture
def other_user(user_factory):
    return user_factory(email="other@example.com")


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_login(user)
    return api_client
