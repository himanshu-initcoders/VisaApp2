#!/usr/bin/env bash
# One-time full data transfer: Neon (or any Postgres URL) → Docker Compose Postgres.
#
# Prerequisites:
#   - /opt/visa/.env with NEON_DATABASE_URL, POSTGRES_*, DATABASE_URL (pointing at db)
#   - Docker Compose db service healthy
#   - pg_dump / pg_restore client tools OR use dockerized dump (see below)
#
# Usage (from repo root on the VPS):
#   chmod +x deploy/scripts/neon-to-postgres.sh
#   ./deploy/scripts/neon-to-postgres.sh
#
# Optional:
#   DUMP_FILE=/tmp/neon.dump ./deploy/scripts/neon-to-postgres.sh
#   SKIP_DUMP=1 DUMP_FILE=/tmp/neon.dump ./deploy/scripts/neon-to-postgres.sh   # restore only

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DUMP_FILE="${DUMP_FILE:-$ROOT_DIR/neon.dump}"
COMPOSE="${COMPOSE:-docker compose}"
POSTGRES_USER="${POSTGRES_USER:-visa}"
POSTGRES_DB="${POSTGRES_DB:-visa_db}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

need docker

[[ -n "${NEON_DATABASE_URL:-}" ]] || [[ "${SKIP_DUMP:-0}" == "1" ]] \
  || die "Set NEON_DATABASE_URL in .env (or SKIP_DUMP=1 with an existing DUMP_FILE)"

echo "==> Ensuring Postgres (db) is up"
$COMPOSE up -d db
$COMPOSE exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

if [[ "${SKIP_DUMP:-0}" != "1" ]]; then
  echo "==> Dumping Neon to $DUMP_FILE (custom format)"
  # Always use a client matching (or newer than) Neon server major version.
  # Host pg_dump is often older (e.g. 16) while Neon may be 17/18.
  docker run --rm \
    -e "NEON_DATABASE_URL=$NEON_DATABASE_URL" \
    -v "$(dirname "$DUMP_FILE"):/out" \
    postgres:18-alpine \
    sh -c "pg_dump \"\$NEON_DATABASE_URL\" --no-owner --no-acl -Fc -f /out/$(basename "$DUMP_FILE")"
  [[ -s "$DUMP_FILE" ]] || die "Dump file is empty: $DUMP_FILE"
  echo "    Dump size: $(du -h "$DUMP_FILE" | awk '{print $1}')"
else
  [[ -s "$DUMP_FILE" ]] || die "SKIP_DUMP=1 but dump missing/empty: $DUMP_FILE"
fi

echo "==> Restoring into Docker Postgres ($POSTGRES_DB)"
# Copy dump into the db container and restore (handles Windows/WSL path quirks)
DUMP_BASENAME="$(basename "$DUMP_FILE")"
$COMPOSE cp "$DUMP_FILE" "db:/tmp/$DUMP_BASENAME"
$COMPOSE exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner --no-acl \
    "/tmp/$DUMP_BASENAME" \
  || {
    # pg_restore returns non-zero on some benign warnings; verify tables exist below
    echo "WARN: pg_restore exited non-zero — continuing with sanity checks"
  }

echo "==> Sanity checks (row counts)"
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS table_name, COUNT(*)::bigint AS rows FROM users
UNION ALL
SELECT 'visa_applications', COUNT(*)::bigint FROM visa_applications
UNION ALL
SELECT 'passport_services', COUNT(*)::bigint FROM passport_services
UNION ALL
SELECT '__drizzle_migrations', COUNT(*)::bigint FROM drizzle.__drizzle_migrations
ORDER BY 1;
SQL

echo
echo "OK: Restore finished."
echo "Next:"
echo "  1. Confirm DATABASE_URL points at Docker Postgres (host=db)."
echo "  2. Do NOT run db:migrate on a freshly restored DB (schema + drizzle history already present)."
echo "  3. docker compose up -d app caddy jenkins"
echo "  4. Smoke-test login + one application, then treat Neon as read-only backup."
echo "  5. Remove NEON_DATABASE_URL from .env when cutover is stable."
