#!/usr/bin/env bash
# End-to-end smoke test for the week-1 Dbench surface (auth + connections).
# Runs against the Next.js proxy (default http://localhost:3000) so cookies,
# CSRF, and the Django proxy path are exercised exactly as the browser does.
# The saved/draft connection tests hit the real compose Postgres via psycopg.
set -euo pipefail

BASE="${1:-http://localhost:3000}"
JAR="$(mktemp)"
TMP="$(mktemp -d)"
trap 'rm -rf "$JAR" "$TMP"' EXIT

PASS=0

fail() {
  echo "FAIL: $1" >&2
  if [ -f "$TMP/body" ]; then
    echo "--- last response body ---" >&2
    cat "$TMP/body" >&2
    echo >&2
  fi
  exit 1
}

step() {
  PASS=$((PASS + 1))
  echo "  ok   $1"
}

code() { curl -sS -c "$JAR" -b "$JAR" -o "$TMP/body" -w '%{http_code}' "$@"; }
csrf() { awk '$6 == "csrftoken" {print $7}' "$JAR" | tail -1; }
json() { python3 -c "import json; d=json.load(open('$TMP/body')); print($1)"; }

echo "Smoke test against $BASE"

# --- health & anonymous access ---------------------------------------------
c=$(code "$BASE/api/health/")
[ "$c" = "200" ] || fail "health returned $c"
json "d['status']" | grep -q "ok" || fail "health body was not ok"
step "GET /api/health/ via proxy"

c=$(code "$BASE/api/auth/me/")
[ "$c" = "401" ] || fail "anonymous me returned $c (expected 401)"
step "anonymous GET /api/auth/me/ is 401"

# --- register + session -----------------------------------------------------
STAMP="$(date +%s)-$RANDOM"
EMAIL="smoke-$STAMP@example.com"
c=$(code -X POST "$BASE/api/auth/register/" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass-123\"}")
[ "$c" = "201" ] || fail "register returned $c"
grep -q "sessionid" "$JAR" || fail "session cookie missing after register"
step "POST /api/auth/register/ -> 201 with session cookie"

TOKEN="$(csrf)"
[ -n "$TOKEN" ] || fail "csrftoken cookie missing after register"
step "CSRF cookie bootstrapped"

c=$(code "$BASE/api/auth/me/")
[ "$c" = "200" ] || fail "me after register returned $c"
json "d['email']" | grep -qx "$EMAIL" || fail "me email mismatch"
step "GET /api/auth/me/ returns registered email"

# --- schema (drf-spectacular) ----------------------------------------------
c=$(code "$BASE/api/schema/")
[ "$c" = "200" ] || fail "OpenAPI schema returned $c"
step "GET /api/schema/ (OpenAPI)"

# --- create connection (target: compose postgres service) -------------------
c=$(code -X POST "$BASE/api/connections/" -H 'Content-Type: application/json' -H "X-CSRFToken: $TOKEN" \
  -d '{"name":"smoke-db","engine":"postgres","host":"postgres","port":5432,"db_name":"dbench","username":"dbench","password":"dbench-dev-pass","ssl_mode":"prefer","read_only":false}')
[ "$c" = "201" ] || fail "create connection returned $c"
BODY="$(cat "$TMP/body")"
if echo "$BODY" | grep -q '"password"'; then fail "create response contains a password key"; fi
if echo "$BODY" | grep -q "dbench-dev-pass"; then fail "create response contains the plaintext password"; fi
json "d['has_password']" | grep -q "True" || fail "has_password is not true"
CONN_ID="$(json "d['id']")"
step "POST /api/connections/ -> 201, no password in response (encrypted at rest)"

# --- CSRF enforcement -------------------------------------------------------
c=$(code -X POST "$BASE/api/connections/" -H 'Content-Type: application/json' \
  -d '{"name":"no-csrf","engine":"postgres","host":"h","port":5432,"db_name":"d","username":"u"}')
[ "$c" = "403" ] || fail "create without X-CSRFToken returned $c (expected 403)"
step "authenticated POST without CSRF token is rejected (403)"

# --- list -------------------------------------------------------------------
c=$(code "$BASE/api/connections/")
[ "$c" = "200" ] || fail "list returned $c"
if cat "$TMP/body" | grep -q "dbench-dev-pass"; then fail "list response contains the plaintext password"; fi
json "len(d)" | grep -q "1" || fail "expected exactly 1 connection"
step "GET /api/connections/ lists 1 connection, no secrets"

# --- test connection against the REAL postgres ------------------------------
c=$(code -X POST "$BASE/api/connections/$CONN_ID/test/" -H "X-CSRFToken: $TOKEN")
[ "$c" = "200" ] || fail "saved test returned $c"
json "d['ok']" | grep -q "True" || fail "saved test not ok: $(cat "$TMP/body")"
json "d['server_version']" | grep -qi "postgresql" || fail "server_version missing"
step "POST /api/connections/{id}/test/ -> ok (real PostgreSQL via psycopg)"

c=$(code -X POST "$BASE/api/connections/test/" -H 'Content-Type: application/json' -H "X-CSRFToken: $TOKEN" \
  -d '{"engine":"postgres","host":"postgres","port":5432,"db_name":"dbench","username":"dbench","password":"dbench-dev-pass","ssl_mode":"prefer"}')
[ "$c" = "200" ] || fail "draft test returned $c"
json "d['ok']" | grep -q "True" || fail "draft test not ok: $(cat "$TMP/body")"
step "POST /api/connections/test/ (draft) -> ok against real PostgreSQL"

c=$(code -X POST "$BASE/api/connections/test/" -H 'Content-Type: application/json' -H "X-CSRFToken: $TOKEN" \
  -d '{"engine":"postgres","host":"postgres","port":5432,"db_name":"dbench","username":"app","password":"wrong-pass","ssl_mode":"prefer"}')
[ "$c" = "200" ] || fail "failing draft test returned $c"
json "d['ok']" | grep -q "False" || fail "bad credentials reported ok"
step "bad credentials report ok=false (error surfaced, not a crash)"

# --- validation -------------------------------------------------------------
c=$(code -X POST "$BASE/api/connections/" -H 'Content-Type: application/json' -H "X-CSRFToken: $TOKEN" \
  -d '{"name":"smoke-db","engine":"postgres","host":"h","port":5432,"db_name":"d","username":"u"}')
[ "$c" = "400" ] || fail "duplicate name returned $c (expected 400)"
step "duplicate connection name rejected (400)"

# --- second user cannot see the first user's connection ---------------------
# Still logged in as user 1, so DRF session CSRF applies to this POST too -
# exactly what the SPA does (it always sends X-CSRFToken on writes).
c=$(code -X POST "$BASE/api/auth/register/" -H 'Content-Type: application/json' -H "X-CSRFToken: $TOKEN" \
  -d "{\"email\":\"smoke2-$STAMP@example.com\",\"password\":\"smoke-pass-123\"}")
[ "$c" = "201" ] || fail "second register returned $c"
TOKEN="$(csrf)"
c=$(code "$BASE/api/connections/$CONN_ID/")
[ "$c" = "404" ] || fail "other user read returned $c (expected 404)"
c=$(code -X DELETE "$BASE/api/connections/$CONN_ID/" -H "X-CSRFToken: $TOKEN")
[ "$c" = "404" ] || fail "other user delete returned $c (expected 404)"
step "second user gets 404 for the first user's connection"

# --- logout -----------------------------------------------------------------
c=$(code -X POST "$BASE/api/auth/logout/" -H "X-CSRFToken: $TOKEN")
[ "$c" = "204" ] || fail "logout returned $c"
c=$(code "$BASE/api/auth/me/")
[ "$c" = "401" ] || fail "me after logout returned $c"
step "POST /api/auth/logout/ -> 204, session cleared"

# --- owner cleanup ----------------------------------------------------------
c=$(code -X POST "$BASE/api/auth/login/" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass-123\"}")
[ "$c" = "200" ] || fail "re-login returned $c"
TOKEN="$(csrf)"
c=$(code -X DELETE "$BASE/api/connections/$CONN_ID/" -H "X-CSRFToken: $TOKEN")
[ "$c" = "204" ] || fail "owner delete returned $c (expected 204)"
step "owner can delete the connection (cleanup)"

echo "PASS: $PASS steps"
