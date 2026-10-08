# Dbench

Web tool to connect to multiple databases, explore schemas, run SQL, and edit data safely from one interface. Implementation follows [DB Manager PRD.md](./DB%20Manager%20PRD.md).

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn-style components) · Django 5 + DRF (Python 3.12) · PostgreSQL (app metadata) · Docker Compose.

## Quickstart (Docker — recommended)

```bash
cp .env.example .env
# put generated values in .env:
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(48))"
python3 -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

docker compose up -d --build
```

- App: http://localhost:3000 (register — the first account becomes admin)
- API docs: http://localhost:8000/api/docs/ · schema: `/api/schema/`
- Real-time (Soketi, week 5-6): ws://localhost:6001 — not wired yet

## Local development

```bash
# backend (Python 3.12 via uv: https://docs.astral.sh/uv/)
cd backend
cp .env.example .env   # fill SECRET_KEY + ENCRYPTION_KEY (see comments in the file)
uv sync
uv run python manage.py migrate
uv run python manage.py runserver 8000

# frontend (second terminal)
cd frontend
cp .env.example .env   # BACKEND_URL=http://localhost:8000
npm install
npm run dev            # http://localhost:3000
```

## Tests

| Gate | Command | Latest result |
| --- | --- | --- |
| Backend unit/API | `cd backend && uv run pytest` | 25 passed |
| Frontend unit | `cd frontend && npm run test` | 14 passed |
| Frontend build | `cd frontend && npm run build` | clean (6 routes) |
| E2E smoke (needs `docker compose up`) | `./scripts/smoke.sh` | 16/16 steps |

The smoke script runs entirely through the Next.js proxy with real cookies/CSRF and tests connection status against the compose PostgreSQL via psycopg.

## Layout

```
├─ frontend/          Next.js app (app/api/[...path] proxies to Django)
├─ backend/           Django project (config/ + apps/ + migrations)
│  ├─ apps/accounts   custom email user, register/login/logout/me
│  ├─ apps/connections  CRUD, Fernet encryption, test-connection
├─ scripts/smoke.sh   end-to-end smoke test
├─ docker-compose.yml web, api, postgres, soketi
└─ DB Manager PRD.md
```

## Week-1/2 status (PRD §14 row 1) and known limitations

Done: repo scaffold, Docker Compose (4 services), session-cookie auth with CSRF (httpOnly cookies, Next proxy), connections CRUD with Fernet-encrypted passwords/SSH config (write-only fields, never returned), connection test for Postgres+MySQL incl. SSH tunnel, OpenAPI schema, test suites.

Deliberate scope cuts / notes:

- **Safety checks (F6), read-only enforcement (F7), exports (F8), history (F9)** — weeks 3-6 per the PRD timeline; `read_only` is stored but not yet enforced.
- **Soketi:** the Docker Hub image was removed; compose uses the official `quay.io/soketi/soketi` registry (pinned `1.6-16-debian`). Upstream is low-activity — re-evaluate at week 5-6 (PRD risk table); any Pusher-protocol server can be swapped in.
- **MySQL test connection** honors `ssl_mode=disable` only; full MySQL SSL lands with the week-7 driver.
- **SSH tunnels** support password auth (no key files yet).
- Django admin static files are not served in the container (needs the Nginx/Caddy front from PRD §9); the API itself is complete.
- `django-filter` from PRD §9 not installed yet — no filtered endpoints exist to justify it.
- App DB: Postgres in Docker, sqlite for local dev/tests (same ORM code path).
# Dbench
