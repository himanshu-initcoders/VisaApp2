#!/usr/bin/env bash
# Move data from the old Compose `db` container → host Postgres, then remove Compose db.
#
# Order:
#   1. Dump while Docker db is still running
#   2. Stop/remove Docker db (frees 127.0.0.1:5432)
#   3. Ensure host Postgres is up (install-host-postgres.sh)
#   4. Restore
#
# Usage (as root, /opt/visa):
#   ./deploy/scripts/docker-db-to-host.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-visa}"
POSTGRES_DB="${POSTGRES_DB:-visa_db}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
COMPOSE="${COMPOSE:-docker compose}"
DUMP_FILE="${DUMP_FILE:-$ROOT_DIR/docker-db.dump}"

die() { echo "ERROR: $*" >&2; exit 1; }

echo "==> Dump from Docker db container (while still running)"
$COMPOSE ps --status running db >/dev/null 2>&1 \
  || die "Compose service 'db' is not running"

$COMPOSE exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl -Fc -f /tmp/docker-db.dump
$COMPOSE cp "db:/tmp/docker-db.dump" "$DUMP_FILE"
[[ -s "$DUMP_FILE" ]] || die "Empty dump"

echo "==> Stop and remove Docker db (release 5432)"
$COMPOSE stop db
$COMPOSE rm -f db

if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "==> Host Postgres not up — installing"
  "$ROOT_DIR/deploy/scripts/install-host-postgres.sh"
fi

pg_isready -h 127.0.0.1 -p 5432 >/dev/null \
  || die "Host Postgres still not ready on 127.0.0.1:5432"

echo "==> Restore into host Postgres"
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-acl \
  "$DUMP_FILE" \
  || echo "WARN: pg_restore exited non-zero — checking tables"

psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
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
echo "OK: Data is on host Postgres. Update DATABASE_URL to host.docker.internal and recreate app."
