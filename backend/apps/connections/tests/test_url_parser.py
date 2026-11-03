from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.connections.models import Connection
from apps.connections.url_parser import parse_database_url


class TestDatabaseURLParser:
    def test_standard_postgres_url(self):
        url = "postgresql://postgres:secret123@db.internal.example:5432/production_db?sslmode=require"
        result = parse_database_url(url)
        assert result == {
            "engine": Connection.Engine.POSTGRES,
            "host": "db.internal.example",
            "port": 5432,
            "db_name": "production_db",
            "username": "postgres",
            "password": "secret123",
            "ssl_mode": Connection.SslMode.REQUIRE,
        }

    def test_postgres_scheme_alias_and_default_port(self):
        url = "postgres://myuser:mypass@localhost/devdb"
        result = parse_database_url(url)
        assert result["engine"] == Connection.Engine.POSTGRES
        assert result["port"] == 5432
        assert result["host"] == "localhost"
        assert result["db_name"] == "devdb"
        assert result["username"] == "myuser"
        assert result["password"] == "mypass"
        assert result["ssl_mode"] == Connection.SslMode.PREFER

    def test_standard_mysql_url(self):
        url = "mysql://admin:secret@127.0.0.1:3306/shop_db"
        result = parse_database_url(url)
        assert result == {
            "engine": Connection.Engine.MYSQL,
            "host": "127.0.0.1",
            "port": 3306,
            "db_name": "shop_db",
            "username": "admin",
            "password": "secret",
            "ssl_mode": Connection.SslMode.PREFER,
        }

    def test_mysql_variants_and_default_port(self):
        for scheme in ("mysql2", "mariadb"):
            url = f"{scheme}://root:toor@db.internal/inventory"
            result = parse_database_url(url)
            assert result["engine"] == Connection.Engine.MYSQL
            assert result["port"] == 3306
            assert result["host"] == "db.internal"
            assert result["db_name"] == "inventory"

    def test_percent_encoded_credentials(self):
        # Username 'app@company.com' (%40) and password 'p#ss/w?rd' (%23, %2F, %3F)
        url = "postgresql://app%40company.com:p%23ss%2Fw%3Frd@db.example.com:5432/secure_db"
        result = parse_database_url(url)
        assert result["username"] == "app@company.com"
        assert result["password"] == "p#ss/w?rd"
        assert result["db_name"] == "secure_db"

    def test_ssl_query_parameter_mappings(self):
        cases = [
            ("sslmode=require", Connection.SslMode.REQUIRE),
            ("sslmode=disable", Connection.SslMode.DISABLE),
            ("sslmode=allow", Connection.SslMode.ALLOW),
            ("sslmode=prefer", Connection.SslMode.PREFER),
            ("sslmode=verify-ca", Connection.SslMode.VERIFY_CA),
            ("sslmode=verify_ca", Connection.SslMode.VERIFY_CA),
            ("sslmode=verify-full", Connection.SslMode.VERIFY_FULL),
            ("sslmode=verify_full", Connection.SslMode.VERIFY_FULL),
            ("ssl=true", Connection.SslMode.REQUIRE),
            ("ssl=1", Connection.SslMode.REQUIRE),
            ("ssl=false", Connection.SslMode.DISABLE),
            ("ssl=0", Connection.SslMode.DISABLE),
        ]
        for query, expected_ssl in cases:
            url = f"postgresql://usr:pwd@host:5432/db?{query}"
            result = parse_database_url(url)
            assert result["ssl_mode"] == expected_ssl, f"Failed for query '{query}'"

    def test_missing_or_empty_url_raises_validation_error(self):
        with pytest.raises(ValidationError) as exc:
            parse_database_url("")
        assert "cannot be empty" in str(exc.value)

        with pytest.raises(ValidationError):
            parse_database_url("   ")

    def test_unsupported_scheme_raises_validation_error(self):
        for unsupported in ("sqlite:///local.db", "mongodb://localhost:27017/db", "redis://localhost:6379"):
            with pytest.raises(ValidationError) as exc:
                parse_database_url(unsupported)
            assert "Unsupported database scheme" in str(exc.value)

    def test_missing_host_raises_validation_error(self):
        with pytest.raises(ValidationError) as exc:
            parse_database_url("postgresql:///mydb")
        assert "Missing host" in str(exc.value)
