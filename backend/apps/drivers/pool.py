from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from psycopg_pool import ConnectionPool

from .tunnel import SSHTunnel

logger = logging.getLogger(__name__)


@dataclass
class RunInfo:
    run_id: str
    connection_id: str | None
    engine: str
    backend_id: int | None
    started_at: float
    driver: Any = None


class RunTracker:
    """Thread-safe registry mapping run_id -> backend PID for query cancellation (PRD §10)."""

    def __init__(self):
        self._runs: dict[str, RunInfo] = {}
        self._lock = threading.Lock()

    def register(
        self,
        run_id: str,
        connection_id: str | None,
        engine: str,
        backend_id: int | None,
        driver: Any = None,
    ) -> RunInfo:
        with self._lock:
            info = RunInfo(
                run_id=run_id,
                connection_id=connection_id,
                engine=engine,
                backend_id=backend_id,
                started_at=time.time(),
                driver=driver,
            )
            self._runs[run_id] = info
            return info

    def unregister(self, run_id: str) -> RunInfo | None:
        with self._lock:
            return self._runs.pop(run_id, None)

    def get(self, run_id: str) -> RunInfo | None:
        with self._lock:
            return self._runs.get(run_id)

    def active_runs(self) -> list[RunInfo]:
        with self._lock:
            return list(self._runs.values())


class ManagedPool:
    """Wraps a driver pool along with an optional SSH tunnel and access tracking."""

    def __init__(self, pool_id: str, pool: ConnectionPool, tunnel: SSHTunnel | None = None):
        self.pool_id = pool_id
        self.pool = pool
        self.tunnel = tunnel
        self.last_used = time.time()

    def touch(self):
        self.last_used = time.time()

    def close(self):
        try:
            self.pool.close()
        except Exception as exc:
            logger.debug("Error closing connection pool %s: %s", self.pool_id, exc)
        if self.tunnel is not None:
            self.tunnel.stop()


class PoolManager:
    """Manages connection pools per connection configuration."""

    def __init__(self, idle_timeout: float = 300.0):
        self.idle_timeout = idle_timeout
        self._pools: dict[str, ManagedPool] = {}
        self._lock = threading.Lock()

    def _pool_key(self, config: dict[str, Any]) -> str:
        # Key based on connection ID if available, or identity tuple
        conn_id = config.get("id") or config.get("connection_id")
        if conn_id:
            return f"conn:{conn_id}"
        host = config.get("host", "")
        port = config.get("port", 5432)
        db = config.get("db_name", "")
        user = config.get("username", "")
        read_only = bool(config.get("read_only", False))
        return f"adhoc:{user}@{host}:{port}/{db}:ro={read_only}"

    def get_pg_pool(self, config: dict[str, Any]) -> ManagedPool:
        key = self._pool_key(config)
        with self._lock:
            self._evict_idle_locked()
            existing = self._pools.get(key)
            if existing is not None:
                existing.touch()
                return existing

            # Open tunnel if required
            tunnel = None
            host = config.get("host", "127.0.0.1")
            port = int(config.get("port") or 5432)
            ssh_config = config.get("ssh_config") or {}
            if ssh_config.get("enabled"):
                tunnel = SSHTunnel(ssh_config, host, port)
                host, port = tunnel.start()

            read_only = bool(config.get("read_only", False))

            def configure_connection(conn):
                if read_only:
                    conn.execute("SET default_transaction_read_only = on;")

            connect_kwargs: dict[str, Any] = {
                "host": host,
                "port": port,
                "dbname": config.get("db_name", ""),
                "user": config.get("username", ""),
                "connect_timeout": 6,
                "sslmode": config.get("ssl_mode") or "prefer",
            }
            if config.get("password"):
                connect_kwargs["password"] = config["password"]

            pool = ConnectionPool(
                conninfo="",
                kwargs=connect_kwargs,
                min_size=1,
                max_size=5,
                max_idle=self.idle_timeout,
                max_lifetime=1800.0,
                timeout=10.0,
                configure=configure_connection,
                check=ConnectionPool.check_connection,
                open=True,
            )

            managed = ManagedPool(pool_id=key, pool=pool, tunnel=tunnel)
            self._pools[key] = managed
            return managed

    def close_pool(self, key: str):
        with self._lock:
            managed = self._pools.pop(key, None)
            if managed:
                managed.close()

    def close_all(self):
        with self._lock:
            for managed in self._pools.values():
                managed.close()
            self._pools.clear()

    def _evict_idle_locked(self):
        now = time.time()
        to_delete = []
        for key, managed in self._pools.items():
            if now - managed.last_used > self.idle_timeout:
                to_delete.append(key)
        for key in to_delete:
            managed = self._pools.pop(key, None)
            if managed:
                managed.close()


# Singleton instances
run_tracker = RunTracker()
pool_manager = PoolManager()
