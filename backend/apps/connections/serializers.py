import json

from django.conf import settings
from rest_framework import serializers

from .crypto import decrypt, encrypt
from .models import Connection
from .url_parser import parse_database_url


def validate_not_app_database(attrs: dict) -> None:
    """Disallow connecting to DBench's own operational database."""
    default_db = getattr(settings, "DATABASES", {}).get("default", {})
    engine = default_db.get("ENGINE", "")
    if "sqlite" in engine:
        return

    app_host = (default_db.get("HOST") or "localhost").lower().strip()
    app_port = int(default_db.get("PORT") or 5432)
    app_name = (default_db.get("NAME") or "").lower().strip()

    target_host = (attrs.get("host") or "").lower().strip()
    target_port = int(attrs.get("port") or (5432 if attrs.get("engine") == Connection.Engine.POSTGRES else 3306))
    target_name = (attrs.get("db_name") or "").lower().strip()

    is_same_host = (
        target_host == app_host or
        (app_host in ("localhost", "127.0.0.1") and target_host in ("localhost", "127.0.0.1"))
    )

    if is_same_host and target_port == app_port and target_name == app_name and app_name:
        raise serializers.ValidationError({
            "db_name": "Connecting to DBench's own application database is not permitted."
        })


class SSHConfigSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(default=False)
    host = serializers.CharField(required=False, allow_blank=True, default="", max_length=255)
    port = serializers.IntegerField(required=False, min_value=1, max_value=65535, default=22)
    username = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)
    password = serializers.CharField(
        required=False, allow_blank=True, default="", write_only=True, max_length=255
    )

    def validate(self, attrs):
        if attrs.get("enabled"):
            if not attrs.get("host"):
                raise serializers.ValidationError({"host": "SSH host is required when the tunnel is enabled."})
            if not attrs.get("username"):
                raise serializers.ValidationError({"username": "SSH username is required when the tunnel is enabled."})
        return attrs


class ConnectionSerializer(serializers.ModelSerializer):
    # Write-only secrets: never present in any response payload (F2).
    database_url = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
    )
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=255,
        style={"input_type": "password"},
    )
    ssh_config = SSHConfigSerializer(required=False)
    has_password = serializers.SerializerMethodField()
    has_ssh_password = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = [
            "id", "name", "engine", "host", "port", "db_name", "username",
            "password", "database_url", "ssl_mode", "ssh_config", "read_only",
            "has_password", "has_ssh_password", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_internal_value(self, data):
        database_url = data.get("database_url")
        if database_url and isinstance(database_url, str) and database_url.strip():
            parsed = parse_database_url(database_url)
            data = data.copy() if hasattr(data, "copy") else dict(data)
            for key, val in parsed.items():
                if key not in data or data[key] in (None, ""):
                    data[key] = val
            if not data.get("name") and parsed.get("db_name"):
                data["name"] = f"{parsed['db_name']} ({parsed['host']})"
        return super().to_internal_value(data)

    def get_has_password(self, obj) -> bool:
        return bool(obj.encrypted_password)

    def get_has_ssh_password(self, obj) -> bool:
        if not obj.encrypted_ssh_config:
            return False
        try:
            return bool(json.loads(decrypt(obj.encrypted_ssh_config)).get("password"))
        except Exception:  # noqa: BLE001 - missing/unreadable secret == no secret
            return False

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        owner = self.context["request"].user
        qs = Connection.objects.filter(owner=owner, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("You already have a connection with this name.")
        return value

    def validate(self, attrs):
        host = attrs.get("host") if "host" in attrs else (self.instance.host if self.instance else "")
        port = attrs.get("port") if "port" in attrs else (self.instance.port if self.instance else 5432)
        db_name = attrs.get("db_name") if "db_name" in attrs else (self.instance.db_name if self.instance else "")
        engine = attrs.get("engine") if "engine" in attrs else (self.instance.engine if self.instance else Connection.Engine.POSTGRES)
        validate_not_app_database({
            "host": host,
            "port": port,
            "db_name": db_name,
            "engine": engine,
        })
        return attrs

    def _encrypt_ssh(self, ssh: dict | None) -> str:
        if not ssh or not ssh.get("enabled"):
            return ""
        secret = {k: v for k, v in ssh.items() if v not in (None, "")}
        return encrypt(json.dumps(secret))

    def create(self, validated_data):
        validated_data.pop("database_url", None)
        password = validated_data.pop("password", "")
        ssh = validated_data.pop("ssh_config", None)
        connection = Connection.objects.create(**validated_data)
        if password:
            connection.encrypted_password = encrypt(password)
        connection.encrypted_ssh_config = self._encrypt_ssh(ssh)
        connection.save(update_fields=["encrypted_password", "encrypted_ssh_config", "updated_at"])
        return connection

    def update(self, instance, validated_data):
        # An omitted or blank password/ssh_config means "keep the stored one".
        validated_data.pop("database_url", None)
        password = validated_data.pop("password", None)
        ssh = validated_data.pop("ssh_config", serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.encrypted_password = encrypt(password)
        if ssh is not serializers.empty:
            instance.encrypted_ssh_config = self._encrypt_ssh(ssh)
        instance.save()
        return instance


class ConnectionTestSerializer(serializers.Serializer):
    """Config for testing an unsaved connection draft."""

    database_url = serializers.CharField(write_only=True, required=False, allow_blank=True)
    engine = serializers.ChoiceField(choices=Connection.Engine.choices, required=False)
    host = serializers.CharField(max_length=255, required=False)
    port = serializers.IntegerField(min_value=1, max_value=65535, required=False)
    db_name = serializers.CharField(max_length=120, required=False)
    username = serializers.CharField(max_length=120, allow_blank=True, default="", required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="", max_length=255)
    ssl_mode = serializers.ChoiceField(choices=Connection.SslMode.choices, default=Connection.SslMode.PREFER, required=False)
    ssh_config = SSHConfigSerializer(required=False)

    def to_internal_value(self, data):
        database_url = data.get("database_url")
        if database_url and isinstance(database_url, str) and database_url.strip():
            parsed = parse_database_url(database_url)
            data = data.copy() if hasattr(data, "copy") else dict(data)
            for key, val in parsed.items():
                if key not in data or data[key] in (None, ""):
                    data[key] = val
        return super().to_internal_value(data)

    def validate(self, attrs):
        missing = {}
        if not attrs.get("engine"):
            missing["engine"] = "Engine is required (specify engine or provide database_url)."
        if not attrs.get("host"):
            missing["host"] = "Host is required (specify host or provide database_url)."
        if not attrs.get("db_name"):
            missing["db_name"] = "Database name is required (specify db_name or provide database_url)."
        if missing:
            raise serializers.ValidationError(missing)
        validate_not_app_database(attrs)
        return attrs

    def to_config(self) -> dict:
        data = dict(self.validated_data)
        data.pop("database_url", None)
        ssh = data.pop("ssh_config", None)
        if "port" not in data or not data["port"]:
            data["port"] = 5432 if data.get("engine") == Connection.Engine.POSTGRES else 3306
        return {**data, "ssh_config": ssh}
