"""Django settings for the Dbench API.

All runtime configuration comes from environment variables. `backend/.env` is
read when present (local development); in Docker the variables come from
docker-compose directly. SECRET_KEY and ENCRYPTION_KEY are required and the
process fails fast when they are missing or malformed.
"""

import os
from pathlib import Path

import environ
from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1", "api", "testserver"]),
    CSRF_TRUSTED_ORIGINS=(
        list,
        ["http://localhost:3000", "http://127.0.0.1:3000","http://localhost:3001", "http://127.0.0.1:3001"],
    ),
    ALLOW_REGISTRATION=(bool, True),
    ALLOW_LOCAL_CONNECTIONS=(bool, True),
    COOKIE_SECURE=(bool, False),
)

env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("SECRET_KEY")
ENCRYPTION_KEY = env("ENCRYPTION_KEY")

try:
    Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as exc:  # noqa: BLE001 - any failure means the key is unusable
    raise ImproperlyConfigured(
        "ENCRYPTION_KEY must be a urlsafe base64-encoded 32-byte Fernet key. "
        'Generate one with: python -c "from cryptography.fernet import Fernet; '
        'print(Fernet.generate_key().decode())"'
    ) from exc

DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")
ALLOW_REGISTRATION = env.bool("ALLOW_REGISTRATION")
ALLOW_LOCAL_CONNECTIONS = env.bool("ALLOW_LOCAL_CONNECTIONS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "apps.accounts",
    "apps.connections",
    "apps.explorer",
    "apps.queries",
    "apps.browser",
    "apps.notifications",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

if env("DATABASE_URL", default=""):
    DATABASES = {"default": env.db()}
    # Support PostgreSQL search_path for public (app models) and django (system tables)
    if DATABASES["default"].get("ENGINE", "").endswith("postgresql"):
        DATABASES["default"].setdefault("OPTIONS", {})
        existing_opts = DATABASES["default"]["OPTIONS"].get("options", "")
        if "search_path" not in existing_opts:
            DATABASES["default"]["OPTIONS"]["options"] = f"-c search_path=public,django {existing_opts}".strip()
else:
    # Built directly (not via a URL) so paths with spaces work fine.
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Cookies travel browser -> Next.js proxy -> Django. The browser origin is the
# Next.js origin, so Django must trust it for CSRF Origin checks; the session
# cookie itself is SameSite=Lax and only ever sent same-site.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env.bool("COOKIE_SECURE")
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # the SPA reads the token and echoes it in X-CSRFToken
CSRF_COOKIE_SECURE = env.bool("COOKIE_SECURE")

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = CSRF_TRUSTED_ORIGINS

REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="600/min"),
        "auth": env("THROTTLE_AUTH", default="10/min"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Dbench API",
    "VERSION": "0.1.0",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
}

# Filled by config/crypto-free validation above; exposed so services can fail
# with a clear message instead of a raw cryptography error.
DBENCH_ENCRYPTION_KEY = ENCRYPTION_KEY

# Soketi / Pusher Real-Time Event Dispatch (PRD F14)
SOKETI_HOST = env("SOKETI_HOST", default="127.0.0.1")
SOKETI_PORT = env.int("SOKETI_PORT", default=6001)
SOKETI_APP_ID = env("SOKETI_APP_ID", default="app-id")
SOKETI_APP_KEY = env("SOKETI_APP_KEY", default="app-key")
SOKETI_APP_SECRET = env("SOKETI_APP_SECRET", default="app-secret")
SOKETI_USE_TLS = env.bool("SOKETI_USE_TLS", default=False)
SOKETI_ENABLED = env.bool("SOKETI_ENABLED", default=True)
SOKETI_TIMEOUT = env.int("SOKETI_TIMEOUT", default=2)

