from __future__ import annotations

from typing import Any

from .base import BaseDriver
from .mysql import MySQLDriver
from .postgres import PostgresDriver


def get_driver(config: dict[str, Any]) -> BaseDriver:
    """Instantiate a database driver instance for a given configuration dict."""
    engine = (config.get("engine") or "").lower().strip()
    if engine == "postgres":
        return PostgresDriver(config)
    if engine == "mysql":
        return MySQLDriver(config)
    raise ValueError(f"Unsupported database engine: '{engine}'. Expected 'postgres' or 'mysql'.")
