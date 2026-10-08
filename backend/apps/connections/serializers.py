import json

from rest_framework import serializers

from .crypto import decrypt, encrypt
from .models import Connection


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
            "password", "ssl_mode", "ssh_config", "read_only",
            "has_password", "has_ssh_password", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

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

    def _encrypt_ssh(self, ssh: dict | None) -> str:
        if not ssh or not ssh.get("enabled"):
            return ""
        secret = {k: v for k, v in ssh.items() if v not in (None, "")}
        return encrypt(json.dumps(secret))

    def create(self, validated_data):
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

    engine = serializers.ChoiceField(choices=Connection.Engine.choices)
    host = serializers.CharField(max_length=255)
    port = serializers.IntegerField(min_value=1, max_value=65535, required=False)
    db_name = serializers.CharField(max_length=120)
    username = serializers.CharField(max_length=120, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="", max_length=255)
    ssl_mode = serializers.ChoiceField(choices=Connection.SslMode.choices, default=Connection.SslMode.PREFER)
    ssh_config = SSHConfigSerializer(required=False)

    def to_config(self) -> dict:
        data = dict(self.validated_data)
        ssh = data.pop("ssh_config", None)
        if "port" not in data:
            data["port"] = 5432 if data.get("engine") == Connection.Engine.POSTGRES else 3306
        return {**data, "ssh_config": ssh}
