import uuid

from django.conf import settings
from django.db import models

from .crypto import decrypt


class Connection(models.Model):
    class Engine(models.TextChoices):
        POSTGRES = "postgres", "PostgreSQL"
        MYSQL = "mysql", "MySQL"

    class SslMode(models.TextChoices):
        DISABLE = "disable", "disable"
        ALLOW = "allow", "allow"
        PREFER = "prefer", "prefer"
        REQUIRE = "require", "require"
        VERIFY_CA = "verify-ca", "verify-ca"
        VERIFY_FULL = "verify-full", "verify-full"

    class Environment(models.TextChoices):
        PRODUCTION = "production", "Production"
        STAGING = "staging", "Staging"
        DEVELOPMENT = "development", "Development"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connections"
    )
    name = models.CharField(max_length=120)
    engine = models.CharField(max_length=16, choices=Engine.choices, default=Engine.POSTGRES)
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=5432)
    db_name = models.CharField(max_length=120)
    username = models.CharField(max_length=120)
    encrypted_password = models.TextField(blank=True, default="")
    ssl_mode = models.CharField(
        max_length=16, choices=SslMode.choices, default=SslMode.PREFER
    )
    encrypted_ssh_config = models.TextField(blank=True, default="")
    read_only = models.BooleanField(default=False)
    environment = models.CharField(
        max_length=16, choices=Environment.choices, default=Environment.DEVELOPMENT
    )
    is_production = models.BooleanField(default=False)
    require_approval = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_connection_name_per_owner"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.engine}://{self.host}:{self.port}/{self.db_name})"

    @property
    def ssh_config(self) -> dict:
        """Decrypted SSH settings with every secret stripped (read side of F2)."""
        if not self.encrypted_ssh_config:
            return {}
        try:
            import json

            data = json.loads(decrypt(self.encrypted_ssh_config))
        except Exception:  # noqa: BLE001 - unreadable config behaves as absent
            return {}
        return {
            "enabled": bool(data.get("enabled")),
            "host": data.get("host", ""),
            "port": data.get("port", 22),
            "username": data.get("username", ""),
        }
