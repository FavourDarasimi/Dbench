from __future__ import annotations

import logging
from typing import Any

from django.core.cache import cache
from rest_framework.exceptions import APIException

from apps.connections.models import Connection
from apps.connections.services import config_from_connection
from apps.drivers.base import (
    ColumnMeta,
    DriverAuthenticationError,
    DriverConnectionError,
    DriverError,
    TableMeta,
)
from apps.drivers.factory import get_driver
from config.exceptions import sanitize_message

logger = logging.getLogger(__name__)

CACHE_TTL = 3600  # 1 hour


class DatabaseUnavailableException(APIException):
    status_code = 503
    default_detail = "Target database is unavailable or cannot be reached."
    default_code = "database_unavailable"


class SchemaCacheManager:
    """Manages schema, table, and column metadata caching per connection."""

    @staticmethod
    def _key_schemas(conn_id: str) -> str:
        return f"explorer:schemas:{conn_id}"

    @staticmethod
    def _key_tables(conn_id: str, schema: str) -> str:
        return f"explorer:tables:{conn_id}:{schema}"

    @staticmethod
    def _key_columns(conn_id: str, schema: str, table: str) -> str:
        return f"explorer:columns:{conn_id}:{schema}:{table}"

    @staticmethod
    def _key_tree(conn_id: str) -> str:
        return f"explorer:tree:{conn_id}"

    @staticmethod
    def _key_erd(conn_id: str, schema: str) -> str:
        return f"explorer:erd:{conn_id}:{schema}"

    @staticmethod
    def _key_registry(conn_id: str) -> str:
        return f"explorer:keys:{conn_id}"

    def _register_key(self, conn_id: str, key: str):
        reg_key = self._key_registry(conn_id)
        current = cache.get(reg_key) or []
        if key not in current:
            current.append(key)
            cache.set(reg_key, current, timeout=CACHE_TTL)

    def _get_driver_for_connection(self, connection: Connection):
        try:
            config = config_from_connection(connection)
            return get_driver(config)
        except DriverAuthenticationError as exc:
            raise DatabaseUnavailableException(f"Database authentication failed: {sanitize_message(str(exc))}") from exc
        except DriverConnectionError as exc:
            raise DatabaseUnavailableException(f"Cannot connect to database: {sanitize_message(str(exc))}") from exc
        except DriverError as exc:
            raise DatabaseUnavailableException(f"Database driver error: {sanitize_message(str(exc))}") from exc
        except ValueError as exc:
            raise DatabaseUnavailableException(sanitize_message(str(exc))) from exc

    def get_schemas(self, connection: Connection, force_refresh: bool = False) -> list[str]:
        conn_id = str(connection.id)
        cache_key = self._key_schemas(conn_id)

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

        driver = self._get_driver_for_connection(connection)
        try:
            schemas = driver.list_schemas()
            cache.set(cache_key, schemas, timeout=CACHE_TTL)
            self._register_key(conn_id, cache_key)
            return schemas
        except Exception as exc:
            logger.error("Error listing schemas for connection %s: %s", conn_id, exc)
            raise DatabaseUnavailableException(f"Failed to list schemas: {sanitize_message(str(exc))}") from exc
        finally:
            driver.close()

    def get_tables(self, connection: Connection, schema: str, force_refresh: bool = False) -> list[dict[str, Any]]:
        conn_id = str(connection.id)
        cache_key = self._key_tables(conn_id, schema)

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

        driver = self._get_driver_for_connection(connection)
        try:
            tables = driver.list_tables(schema)
            serialized = [t.to_dict() for t in tables]
            cache.set(cache_key, serialized, timeout=CACHE_TTL)
            self._register_key(conn_id, cache_key)
            return serialized
        except Exception as exc:
            logger.error("Error listing tables for connection %s (schema %s): %s", conn_id, schema, exc)
            raise DatabaseUnavailableException(f"Failed to list tables: {sanitize_message(str(exc))}") from exc
        finally:
            driver.close()

    def get_columns(
        self, connection: Connection, schema: str, table: str, force_refresh: bool = False
    ) -> list[dict[str, Any]]:
        conn_id = str(connection.id)
        cache_key = self._key_columns(conn_id, schema, table)

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

        driver = self._get_driver_for_connection(connection)
        try:
            columns = driver.describe_table(schema, table)
            serialized = [c.to_dict() for c in columns]
            cache.set(cache_key, serialized, timeout=CACHE_TTL)
            self._register_key(conn_id, cache_key)
            return serialized
        except Exception as exc:
            logger.error(
                "Error describing table %s.%s for connection %s: %s", schema, table, conn_id, exc
            )
            raise DatabaseUnavailableException(f"Failed to describe table structure: {sanitize_message(str(exc))}") from exc
        finally:
            driver.close()

    def get_schema_tree(self, connection: Connection, force_refresh: bool = False) -> list[dict[str, Any]]:
        conn_id = str(connection.id)
        tree_key = self._key_tree(conn_id)

        if not force_refresh:
            cached = cache.get(tree_key)
            if cached is not None:
                return cached

        driver = self._get_driver_for_connection(connection)
        try:
            schemas = driver.list_schemas()
            cache.set(self._key_schemas(conn_id), schemas, timeout=CACHE_TTL)
            self._register_key(conn_id, self._key_schemas(conn_id))

            tree = []
            for schema_name in schemas:
                tables = driver.list_tables(schema_name)
                serialized = [t.to_dict() for t in tables]
                table_cache_key = self._key_tables(conn_id, schema_name)
                cache.set(table_cache_key, serialized, timeout=CACHE_TTL)
                self._register_key(conn_id, table_cache_key)

                tree.append({
                    "schema": schema_name,
                    "tables": serialized,
                })

            cache.set(tree_key, tree, timeout=CACHE_TTL)
            self._register_key(conn_id, tree_key)
            return tree
        except Exception as exc:
            logger.error("Error generating schema tree for connection %s: %s", conn_id, exc)
            raise DatabaseUnavailableException(f"Failed to generate schema tree: {exc}") from exc
        finally:
            driver.close()

    def get_erd(self, connection: Connection, schema: str, force_refresh: bool = False) -> dict[str, Any]:
        conn_id = str(connection.id)
        erd_key = self._key_erd(conn_id, schema)

        if not force_refresh:
            cached = cache.get(erd_key)
            if cached is not None:
                return cached

        driver = self._get_driver_for_connection(connection)
        try:
            erd = driver.describe_schema_erd(schema)
            cache.set(erd_key, erd, timeout=CACHE_TTL)
            self._register_key(conn_id, erd_key)
            return erd
        except Exception as exc:
            logger.error(
                "Error retrieving ERD metadata for connection %s (schema %s): %s", conn_id, schema, exc
            )
            raise DatabaseUnavailableException(f"Failed to generate ERD schema: {exc}") from exc
        finally:
            driver.close()

    def invalidate_connection(self, conn_id: str):
        reg_key = self._key_registry(conn_id)
        keys = cache.get(reg_key) or []
        for key in keys:
            cache.delete(key)
        cache.delete(reg_key)
        cache.delete(self._key_schemas(conn_id))
        cache.delete(self._key_tree(conn_id))


schema_cache = SchemaCacheManager()
