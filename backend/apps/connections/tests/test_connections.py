import json
from types import SimpleNamespace

import pytest

from apps.connections.crypto import decrypt, encrypt
from apps.connections.models import Connection

pytestmark = pytest.mark.django_db

CONNECTION_PAYLOAD = {
    "name": "local-dev",
    "engine": "postgres",
    "host": "db.example.internal",
    "port": 5432,
    "db_name": "appdb",
    "username": "app",
    "password": "db-pass-123",
    "ssl_mode": "require",
    "read_only": False,
}


@pytest.fixture
def connection_factory(user):
    def make(owner=None, ssh_config: str = "", **overrides):
        payload = {**CONNECTION_PAYLOAD, **overrides}
        password = payload.pop("password", "db-pass-123")
        return Connection.objects.create(
            owner=owner or user,
            encrypted_password=encrypt(password),
            encrypted_ssh_config=ssh_config,
            **payload,
        )

    return make


class FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query):
        self.query = query

    def fetchone(self):
        return ("PostgreSQL 16.4 on x86_64-pc-linux-gnu, compiled by gcc (fake)",)


class FakePgConnection:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def cursor(self):
        return FakeCursor()


class FakeMySqlConnection:
    def __init__(self):
        self.closed = False

    def cursor(self):
        return FakeCursor()

    def close(self):
        self.closed = True


class FakeTunnel:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.started = False
        self.stopped = False
        self.local_bind_port = 54321

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True


# --- CRUD ------------------------------------------------------------------


def test_connections_require_authentication(api_client):
    assert api_client.get("/api/connections/").status_code == 403


def test_create_connection_hides_password_and_encrypts_at_rest(auth_client):
    resp = auth_client.post("/api/connections/", CONNECTION_PAYLOAD, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["has_password"] is True
    assert "password" not in resp.data
    assert "encrypted_password" not in resp.data
    assert resp.data["ssh_config"] == {} or "password" not in str(resp.data.get("ssh_config"))

    stored = Connection.objects.get(pk=resp.data["id"])
    assert stored.encrypted_password != CONNECTION_PAYLOAD["password"]
    assert stored.encrypted_password.startswith("gAAAAA")  # Fernet token prefix
    assert decrypt(stored.encrypted_password) == CONNECTION_PAYLOAD["password"]


def test_list_only_returns_own_connections(auth_client, connection_factory, other_user):
    mine = connection_factory(name="mine")
    connection_factory(name="theirs", owner=other_user)
    resp = auth_client.get("/api/connections/")
    assert resp.status_code == 200
    assert [row["id"] for row in resp.data] == [str(mine.id)]


def test_cannot_read_update_or_delete_others_connection(auth_client, connection_factory, other_user):
    theirs = connection_factory(name="theirs", owner=other_user)
    assert auth_client.get(f"/api/connections/{theirs.id}/").status_code == 404
    assert auth_client.patch(f"/api/connections/{theirs.id}/", {"host": "x"}, format="json").status_code == 404
    assert auth_client.delete(f"/api/connections/{theirs.id}/").status_code == 404
    assert Connection.objects.filter(pk=theirs.pk).exists()


def test_update_password_rotates_keeps_when_blank_or_omitted(auth_client, connection_factory):
    conn = connection_factory()
    first = auth_client.patch(
        f"/api/connections/{conn.id}/", {"password": "rotated-pass-999"}, format="json"
    )
    assert first.status_code == 200
    conn.refresh_from_db()
    assert decrypt(conn.encrypted_password) == "rotated-pass-999"

    # Blank password means "keep the stored one".
    blank = auth_client.patch(f"/api/connections/{conn.id}/", {"password": ""}, format="json")
    assert blank.status_code == 200
    conn.refresh_from_db()
    assert decrypt(conn.encrypted_password) == "rotated-pass-999"
    assert blank.data["has_password"] is True

    # Omitting the key also keeps it, and other fields still update.
    host = auth_client.patch(f"/api/connections/{conn.id}/", {"host": "new-host"}, format="json")
    assert host.status_code == 200
    assert host.data["host"] == "new-host"
    conn.refresh_from_db()
    assert decrypt(conn.encrypted_password) == "rotated-pass-999"


def test_delete_connection(auth_client, connection_factory):
    conn = connection_factory()
    assert auth_client.delete(f"/api/connections/{conn.id}/").status_code == 204
    assert not Connection.objects.filter(pk=conn.pk).exists()


def test_duplicate_name_rejected_case_insensitive(auth_client, connection_factory):
    connection_factory(name="Prod")
    resp = auth_client.post("/api/connections/", {**CONNECTION_PAYLOAD, "name": "prod"}, format="json")
    assert resp.status_code == 400
    assert "already have a connection" in str(resp.data)


def test_ssh_config_is_encrypted_and_never_returned(auth_client):
    payload = {
        **CONNECTION_PAYLOAD,
        "ssh_config": {
            "enabled": True,
            "host": "bastion.example.com",
            "port": 22,
            "username": "tunnel",
            "password": "ssh-secret",
        },
    }
    resp = auth_client.post("/api/connections/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["has_ssh_password"] is True
    assert "ssh-secret" not in json.dumps(resp.data)
    assert "password" not in resp.data["ssh_config"]

    stored = Connection.objects.get(pk=resp.data["id"])
    parsed = json.loads(decrypt(stored.encrypted_ssh_config))
    assert parsed["password"] == "ssh-secret"
    assert stored.encrypted_ssh_config != "ssh-secret"


def test_ssh_enabled_requires_host_and_username(auth_client):
    payload = {**CONNECTION_PAYLOAD, "ssh_config": {"enabled": True, "host": "", "username": ""}}
    resp = auth_client.post("/api/connections/", payload, format="json")
    assert resp.status_code == 400


# --- test connection (draft) ------------------------------------------------


def test_draft_test_success_reports_version(auth_client, monkeypatch):
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakePgConnection()

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    resp = auth_client.post(
        "/api/connections/test/",
        {k: CONNECTION_PAYLOAD[k] for k in ("engine", "host", "port", "db_name", "username", "password", "ssl_mode")},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["ok"] is True
    assert isinstance(resp.data["latency_ms"], int)
    assert "PostgreSQL" in resp.data["server_version"]
    assert seen["host"] == "db.example.internal"
    assert seen["dbname"] == "appdb"
    assert seen["password"] == "db-pass-123"
    assert seen["sslmode"] == "require"


def test_draft_test_failure_returns_error_payload(auth_client, monkeypatch):
    def fake_connect(**kwargs):
        raise RuntimeError('password authentication failed for user "app"')

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    resp = auth_client.post(
        "/api/connections/test/",
        {k: CONNECTION_PAYLOAD[k] for k in ("engine", "host", "port", "db_name", "username", "password")},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["ok"] is False
    assert "password authentication failed" in resp.data["error"]


def test_draft_test_missing_port_defaults_per_engine(auth_client, monkeypatch):
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakePgConnection()

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    resp = auth_client.post(
        "/api/connections/test/",
        {"engine": "postgres", "host": "h", "db_name": "d", "username": "u"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert seen["port"] == 5432


def test_draft_test_mysql_uses_pymysql(auth_client, monkeypatch):
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakeMySqlConnection()

    monkeypatch.setattr("apps.connections.services.pymysql", SimpleNamespace(connect=fake_connect))
    resp = auth_client.post(
        "/api/connections/test/",
        {"engine": "mysql", "host": "h", "port": 3306, "db_name": "d", "username": "u", "password": "p", "ssl_mode": "disable"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["ok"] is True
    assert seen["ssl_disabled"] is True
    assert seen["database"] == "d"


# --- test connection (saved) ------------------------------------------------


def test_saved_test_decrypts_stored_password(auth_client, connection_factory, monkeypatch):
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakePgConnection()

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    conn = connection_factory()
    resp = auth_client.post(f"/api/connections/{conn.id}/test/")
    assert resp.status_code == 200, resp.data
    assert resp.data["ok"] is True
    assert seen["password"] == "db-pass-123"


def test_saved_test_404_for_other_users_connection(auth_client, connection_factory, other_user):
    theirs = connection_factory(name="theirs", owner=other_user)
    assert auth_client.post(f"/api/connections/{theirs.id}/test/").status_code == 404


def test_saved_test_uses_ssh_tunnel_when_configured(auth_client, connection_factory, monkeypatch):
    tunnel = FakeTunnel()
    monkeypatch.setattr(
        "apps.connections.services.SSHTunnelForwarder", lambda *a, **k: tunnel
    )
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakePgConnection()

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    conn = connection_factory(
        ssh_config=encrypt(
            json.dumps({"enabled": True, "host": "bastion", "port": 22, "username": "tun", "password": "s3cret"})
        )
    )
    resp = auth_client.post(f"/api/connections/{conn.id}/test/")
    assert resp.status_code == 200, resp.data
    assert resp.data["ok"] is True
    assert tunnel.started and tunnel.stopped
    assert seen["host"] == "127.0.0.1"
    assert seen["port"] == 54321
    assert seen["password"] == "db-pass-123"


# --- database_url support ----------------------------------------------------


def test_create_connection_via_database_url(auth_client):
    payload = {
        "database_url": "postgresql://dbuser:supersecret@postgres.internal.net:5432/finance_db?sslmode=require",
    }
    resp = auth_client.post("/api/connections/", payload)
    assert resp.status_code == 201, resp.data
    conn = Connection.objects.get(pk=resp.data["id"])
    assert conn.engine == "postgres"
    assert conn.host == "postgres.internal.net"
    assert conn.port == 5432
    assert conn.db_name == "finance_db"
    assert conn.username == "dbuser"
    assert conn.ssl_mode == "require"
    assert decrypt(conn.encrypted_password) == "supersecret"
    # Verify password and database_url are never leaked in serialized response
    assert "password" not in resp.data
    assert "database_url" not in resp.data
    assert resp.data["has_password"] is True


def test_create_connection_via_database_url_with_custom_name(auth_client):
    payload = {
        "name": "Custom Production DB",
        "database_url": "mysql://root:secret@127.0.0.1:3306/shop",
    }
    resp = auth_client.post("/api/connections/", payload)
    assert resp.status_code == 201, resp.data
    conn = Connection.objects.get(pk=resp.data["id"])
    assert conn.name == "Custom Production DB"
    assert conn.engine == "mysql"
    assert conn.db_name == "shop"


def test_draft_test_via_database_url(auth_client, monkeypatch):
    seen = {}

    def fake_connect(**kwargs):
        seen.update(kwargs)
        return FakePgConnection()

    monkeypatch.setattr("apps.connections.services.psycopg", SimpleNamespace(connect=fake_connect))
    payload = {
        "database_url": "postgresql://testuser:testpass@db.example.com:5432/testdb",
    }
    resp = auth_client.post("/api/connections/test/", payload)
    assert resp.status_code == 200, resp.data
    assert resp.data["ok"] is True
    assert seen["host"] == "db.example.com"
    assert seen["user"] == "testuser"
    assert seen["password"] == "testpass"
    assert seen["dbname"] == "testdb"


def test_parse_database_url_endpoint(auth_client):
    payload = {
        "url": "postgresql://admin:mypassword@localhost:5432/analytics?sslmode=verify-full"
    }
    resp = auth_client.post("/api/connections/parse-url/", payload)
    assert resp.status_code == 200, resp.data
    assert resp.data == {
        "engine": "postgres",
        "host": "localhost",
        "port": 5432,
        "db_name": "analytics",
        "username": "admin",
        "password": "mypassword",
        "ssl_mode": "verify-full",
    }


def test_parse_database_url_endpoint_validation_errors(auth_client):
    # Missing url
    resp = auth_client.post("/api/connections/parse-url/", {})
    assert resp.status_code == 400

    # Unsupported scheme
    resp = auth_client.post("/api/connections/parse-url/", {"url": "mongodb://localhost:27017/db"})
    assert resp.status_code == 400
    assert "Unsupported database scheme" in str(resp.data)

