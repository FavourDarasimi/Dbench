from django.contrib import admin

from .models import Connection


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "engine", "host", "port", "db_name", "read_only", "updated_at")
    list_filter = ("engine", "read_only")
    search_fields = ("name", "host", "db_name", "username", "owner__email")
    # Secrets never render in the admin changelist or change form.
    exclude = ("encrypted_password", "encrypted_ssh_config")
    readonly_fields = ("id", "created_at", "updated_at")
