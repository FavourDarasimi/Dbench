import pytest

from apps.accounts.models import User

pytestmark = pytest.mark.django_db


REGISTER = {"email": "dev@example.com", "password": "sup3r-secret-pw"}
LOGIN = {"email": "dev@example.com", "password": "sup3r-secret-pw"}


def test_register_creates_user_and_auto_logs_in(api_client):
    resp = api_client.post("/api/auth/register/", REGISTER, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["user"]["email"] == "dev@example.com"
    assert "password" not in resp.data["user"]
    assert "sessionid" in resp.cookies
    assert "csrftoken" in resp.cookies

    me = api_client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["email"] == "dev@example.com"


def test_first_user_is_admin_second_is_editor(api_client):
    first = api_client.post("/api/auth/register/", REGISTER, format="json")
    assert first.data["user"]["role"] == "admin"
    second = api_client.post(
        "/api/auth/register/", {"email": "dev2@example.com", "password": "an0ther-passw0rd"}, format="json"
    )
    assert second.data["user"]["role"] == "editor"


def test_register_duplicate_email_rejected(api_client):
    api_client.post("/api/auth/register/", REGISTER, format="json")
    api_client.logout()
    dup = api_client.post("/api/auth/register/", REGISTER, format="json")
    assert dup.status_code == 400
    assert "already exists" in str(dup.data)


def test_register_short_password_rejected(api_client):
    resp = api_client.post("/api/auth/register/", {"email": "a@b.com", "password": "short"}, format="json")
    assert resp.status_code == 400


def test_register_disabled_when_disallowed(api_client, settings):
    settings.ALLOW_REGISTRATION = False
    resp = api_client.post("/api/auth/register/", REGISTER, format="json")
    assert resp.status_code == 403


def test_password_is_hashed_never_stored(api_client):
    api_client.post("/api/auth/register/", REGISTER, format="json")
    user = User.objects.get(email="dev@example.com")
    assert user.password != REGISTER["password"]
    assert user.password.startswith(("pbkdf2_", "argon2"))
    assert user.check_password(REGISTER["password"])


def test_login_success_and_failure(api_client, user_factory):
    user_factory(email="dev@example.com", password="sup3r-secret-pw")
    ok = api_client.post("/api/auth/login/", LOGIN, format="json")
    assert ok.status_code == 200, ok.data
    assert ok.data["user"]["email"] == "dev@example.com"
    assert "sessionid" in ok.cookies
    assert "csrfToken" in ok.data

    api_client.logout()
    bad = api_client.post("/api/auth/login/", {"email": "dev@example.com", "password": "wrong"}, format="json")
    assert bad.status_code == 401
    assert "sessionid" not in bad.cookies


def test_me_anonymous_returns_401_but_bootstraps_csrf(api_client):
    resp = api_client.get("/api/auth/me/")
    assert resp.status_code == 401
    assert "csrftoken" in resp.cookies


def test_logout_clears_session(api_client):
    api_client.post("/api/auth/register/", REGISTER, format="json")
    out = api_client.post("/api/auth/logout/")
    assert out.status_code == 204
    assert api_client.get("/api/auth/me/").status_code == 401
    assert api_client.post("/api/auth/logout/").status_code == 403  # no longer authenticated
