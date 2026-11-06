"""Best-effort connection testing (F1).

This is intentionally *not* the full driver layer from PRD section 10 - it only
proves that credentials/network/SSL reach a server and returns its version.
The BaseDriver abstraction (schema introspection, execute, cancel) lands in
weeks 3-4.
"""

import ipaddress
import json
import socket
import time

from django.conf import settings
import psycopg
import pymysql
from sshtunnel import SSHTunnelForwarder

from config.exceptions import sanitize_message
from .crypto import decrypt

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("169.254.0.0/16"),   # IPv4 Link-Local / Cloud Metadata (IMDS)
    ipaddress.ip_network("fe80::/10"),        # IPv6 Link-Local
]


def validate_connection_host(host: str) -> None:
    """Validate that host does not resolve to restricted link-local or prohibited private addresses."""
    cleaned = (host or "").strip()
    if not cleaned:
        raise ValueError("Host cannot be empty.")

    allow_local = getattr(settings, "ALLOW_LOCAL_CONNECTIONS", True)

    # 1. Direct check if host is an IP address
    try:
        ip = ipaddress.ip_address(cleaned)
        for blocked_net in BLOCKED_IP_NETWORKS:
            if ip in blocked_net:
                raise ValueError("Connection to link-local or cloud metadata addresses is strictly prohibited.")
        if not allow_local and (ip.is_private or ip.is_loopback):
            raise ValueError(f"Connection to private or loopback address '{cleaned}' is not permitted.")
        return
    except ValueError as exc:
        if "prohibited" in str(exc) or "not permitted" in str(exc):
            raise

    # 2. Hostname resolution
    try:
        addr_info = socket.getaddrinfo(cleaned, None)
        for _, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            for blocked_net in BLOCKED_IP_NETWORKS:
                if ip in blocked_net:
                    raise ValueError("Connection to link-local or cloud metadata addresses is strictly prohibited.")
            if not allow_local and (ip.is_private or ip.is_loopback):
                raise ValueError(f"Connection to private or loopback address '{cleaned}' is not permitted.")
    except socket.gaierror:
        # If DNS cannot resolve the host, allow downstream driver/mock to handle socket attempt
        pass


def config_from_connection(conn) -> dict:
    """Build a test config from a stored Connection, decrypting secrets."""
    password = ""
    if conn.encrypted_password:
        try:
            password = decrypt(conn.encrypted_password)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Stored password could not be decrypted (did ENCRYPTION_KEY change?)") from exc
    ssh = None
    if conn.encrypted_ssh_config:
        try:
            ssh = json.loads(decrypt(conn.encrypted_ssh_config))
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Stored SSH config could not be decrypted (did ENCRYPTION_KEY change?)") from exc
    return {
        "id": str(conn.id),
        "engine": conn.engine,
        "host": conn.host,
        "port": conn.port,
        "db_name": conn.db_name,
        "username": conn.username,
        "password": password,
        "ssl_mode": conn.ssl_mode,
        "ssh_config": ssh,
        "read_only": conn.read_only,
        "environment": getattr(conn, "environment", "development"),
        "is_production": getattr(conn, "is_production", False),
        "require_approval": getattr(conn, "require_approval", False),
        "use_pool": True,
    }


def _open_tunnel(ssh: dict, remote_host: str, remote_port: int):
    return SSHTunnelForwarder(
        (ssh["host"], int(ssh.get("port") or 22)),
        ssh_username=ssh.get("username") or None,
        ssh_password=ssh.get("password") or None,
        remote_bind_address=(remote_host, int(remote_port)),
        local_bind_address=("127.0.0.1", 0),
        ssh_connect_timeout=6,
    )


def _test_postgres(config: dict, host: str, port: int) -> str:
    with psycopg.connect(
        host=host,
        port=port,
        dbname=config["db_name"],
        user=config["username"],
        password=config.get("password") or None,
        connect_timeout=6,
        sslmode=config.get("ssl_mode") or "prefer",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            row = cur.fetchone()
    return row[0] if row else ""


def _test_mysql(config: dict, host: str, port: int) -> str:
    # SSL hardening beyond "on/off" arrives with the week-7 MySQL driver; here
    # ssl_mode=disable is honored and other modes use PyMySQL's defaults.
    conn = pymysql.connect(
        host=host,
        port=port,
        user=config["username"],
        passwd=config.get("password") or None,
        database=config["db_name"],
        connect_timeout=6,
        ssl_disabled=(config.get("ssl_mode") == "disable"),
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            row = cur.fetchone()
    finally:
        conn.close()
    return row[0] if row else ""


def _friendly_error(exc: Exception) -> str:
    message = " ".join(str(exc).split())
    cleaned = sanitize_message(f"{type(exc).__name__}: {message}")
    return cleaned[:300]


def run_connection_test(config: dict) -> dict:
    engine = config.get("engine")
    if engine not in ("postgres", "mysql"):
        return {"ok": False, "error": f"Unsupported engine: {engine}", "latency_ms": None, "server_version": None}

    host, port = config["host"], int(config["port"])
    ssh = config.get("ssh_config") or {}
    tunnel = None
    try:
        validate_connection_host(host)
        if ssh.get("enabled"):
            if not ssh.get("host") or not ssh.get("username"):
                return {
                    "ok": False,
                    "error": "SSH tunnel is enabled but its host/username is missing.",
                    "latency_ms": None,
                    "server_version": None,
                }
            validate_connection_host(ssh["host"])
            tunnel = _open_tunnel(ssh, host, port)
            tunnel.start()
            host, port = "127.0.0.1", tunnel.local_bind_port

        started = time.perf_counter()
        if engine == "postgres":
            version = _test_postgres(config, host, port)
        else:
            version = _test_mysql(config, host, port)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {"ok": True, "error": None, "latency_ms": latency_ms, "server_version": version}
    except Exception as exc:  # noqa: BLE001 - driver errors must reach the UI verbatim
        return {"ok": False, "error": _friendly_error(exc), "latency_ms": None, "server_version": None}
    finally:
        if tunnel is not None:
            try:
                tunnel.stop()
            except Exception:  # noqa: BLE001
                pass
