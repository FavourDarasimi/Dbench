from __future__ import annotations

import logging
import re
from typing import Any

from django.conf import settings
import pusher
import pusher.client
import pusher.util

logger = logging.getLogger(__name__)

# Soketi and self-hosted Pusher alternatives allow alphanumeric app IDs (e.g. 'app-id', 'dbench'),
# whereas the standard Pusher SDK defaults to digits only.
_ALPHANUMERIC_APP_ID_RE = re.compile(r"\A[a-zA-Z0-9_\-]+\Z")
pusher.util.app_id_re = _ALPHANUMERIC_APP_ID_RE
pusher.client.app_id_re = _ALPHANUMERIC_APP_ID_RE

_cached_client: pusher.Pusher | None = None


def get_pusher_client() -> pusher.Pusher | None:
    """Return a configured Pusher client instance, or None if disabled."""
    global _cached_client

    if not getattr(settings, "SOKETI_ENABLED", True):
        return None

    if _cached_client is not None:
        return _cached_client

    app_id = getattr(settings, "SOKETI_APP_ID", "app-id")
    key = getattr(settings, "SOKETI_APP_KEY", "app-key")
    secret = getattr(settings, "SOKETI_APP_SECRET", "app-secret")
    host = getattr(settings, "SOKETI_HOST", "127.0.0.1")
    port = getattr(settings, "SOKETI_PORT", 6001)
    use_tls = getattr(settings, "SOKETI_USE_TLS", False)
    timeout = getattr(settings, "SOKETI_TIMEOUT", 2)

    try:
        _cached_client = pusher.Pusher(
            app_id=str(app_id),
            key=str(key),
            secret=str(secret),
            host=str(host),
            port=int(port),
            ssl=bool(use_tls),
            timeout=float(timeout),
        )
        return _cached_client
    except Exception as exc:
        logger.warning("Failed to initialize Pusher/Soketi client: %s", exc)
        return None


def reset_pusher_client() -> None:
    """Clear cached client instance (primarily used for unit testing)."""
    global _cached_client
    _cached_client = None
