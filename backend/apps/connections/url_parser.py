from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from rest_framework.exceptions import ValidationError

from .models import Connection

POSTGRES_SCHEMES = {"postgres", "postgresql"}
MYSQL_SCHEMES = {"mysql", "mysql2", "mariadb"}

SSL_MODE_MAP = {
    "disable": Connection.SslMode.DISABLE,
    "allow": Connection.SslMode.ALLOW,
    "prefer": Connection.SslMode.PREFER,
    "require": Connection.SslMode.REQUIRE,
    "verify-ca": Connection.SslMode.VERIFY_CA,
    "verify_ca": Connection.SslMode.VERIFY_CA,
    "verify-full": Connection.SslMode.VERIFY_FULL,
    "verify_full": Connection.SslMode.VERIFY_FULL,
    "true": Connection.SslMode.REQUIRE,
    "1": Connection.SslMode.REQUIRE,
    "false": Connection.SslMode.DISABLE,
    "0": Connection.SslMode.DISABLE,
}


def parse_database_url(url: str) -> dict[str, Any]:
    """
    Parse a database connection URL string into normalized connection parameters.
    
    Supported schemes:
      - postgresql:// or postgres:// (PostgreSQL)
      - mysql://, mysql2://, or mariadb:// (MySQL)
      
    Returns a dict with:
      - engine: 'postgres' | 'mysql'
      - host: str
      - port: int
      - db_name: str
      - username: str
      - password: str
      - ssl_mode: str
    """
    cleaned_url = (url or "").strip()
    if not cleaned_url:
        raise ValidationError({"database_url": "Database URL cannot be empty."})

    try:
        parsed = urlsplit(cleaned_url)
    except Exception as exc:
        raise ValidationError({"database_url": f"Malformed database URL: {exc}"}) from exc

    scheme = (parsed.scheme or "").lower().strip()
    if scheme in POSTGRES_SCHEMES:
        engine = Connection.Engine.POSTGRES
        default_port = 5432
    elif scheme in MYSQL_SCHEMES:
        engine = Connection.Engine.MYSQL
        default_port = 3306
    else:
        valid_schemes = ", ".join(sorted(POSTGRES_SCHEMES | MYSQL_SCHEMES))
        raise ValidationError({
            "database_url": f"Unsupported database scheme '{scheme}'. Supported schemes are: {valid_schemes}."
        })

    # Host validation
    host = parsed.hostname
    if not host:
        raise ValidationError({"database_url": "Missing host in database URL."})

    # Port resolution
    port = parsed.port or default_port

    # Database name from path
    path = parsed.path.lstrip("/")
    db_name = unquote(path).strip() if path else ""

    # Username and password (unquoted for special chars like %, @, #)
    username = unquote(parsed.username) if parsed.username is not None else ""
    password = unquote(parsed.password) if parsed.password is not None else ""

    # Parse SSL mode from query string
    ssl_mode = Connection.SslMode.PREFER
    if parsed.query:
        query_params = parse_qs(parsed.query, keep_blank_values=False)
        ssl_val = None
        for key in ("sslmode", "ssl-mode", "ssl_mode", "ssl"):
            if key in query_params and query_params[key]:
                ssl_val = query_params[key][0].lower().strip()
                break
        if ssl_val:
            ssl_mode = SSL_MODE_MAP.get(ssl_val, Connection.SslMode.PREFER)

    return {
        "engine": engine,
        "host": host,
        "port": port,
        "db_name": db_name,
        "username": username,
        "password": password,
        "ssl_mode": ssl_mode,
    }
