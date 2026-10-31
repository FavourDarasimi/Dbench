from __future__ import annotations

import logging
from typing import Any
from sshtunnel import SSHTunnelForwarder

from .base import DriverConnectionError

logger = logging.getLogger(__name__)


class SSHTunnel:
    """Manages an SSH tunnel forwarding local requests to a remote database."""

    def __init__(self, ssh_config: dict[str, Any], remote_host: str, remote_port: int):
        self.ssh_config = ssh_config or {}
        self.remote_host = remote_host
        self.remote_port = int(remote_port)
        self.forwarder: SSHTunnelForwarder | None = None
        self.local_host: str = "127.0.0.1"
        self.local_port: int | None = None

    @property
    def is_enabled(self) -> bool:
        return bool(self.ssh_config.get("enabled"))

    def start(self) -> tuple[str, int]:
        """Start the tunnel if enabled, returning (effective_host, effective_port)."""
        if not self.is_enabled:
            return self.remote_host, self.remote_port

        ssh_host = self.ssh_config.get("host")
        ssh_user = self.ssh_config.get("username")
        if not ssh_host or not ssh_user:
            raise DriverConnectionError("SSH tunnel is enabled but host or username is missing.")

        try:
            self.forwarder = SSHTunnelForwarder(
                (ssh_host, int(self.ssh_config.get("port") or 22)),
                ssh_username=ssh_user,
                ssh_password=self.ssh_config.get("password") or None,
                remote_bind_address=(self.remote_host, self.remote_port),
                local_bind_address=("127.0.0.1", 0),
                ssh_connect_timeout=6,
            )
            self.forwarder.start()
            self.local_port = self.forwarder.local_bind_port
            return self.local_host, self.local_port
        except Exception as exc:
            self.stop()
            raise DriverConnectionError(f"Failed to establish SSH tunnel: {exc}", original_exception=exc) from exc

    def stop(self):
        """Stop and tear down the tunnel."""
        if self.forwarder is not None:
            try:
                self.forwarder.stop()
            except Exception as exc:
                logger.debug("Error stopping SSH tunnel: %s", exc)
            finally:
                self.forwarder = None
                self.local_port = None
