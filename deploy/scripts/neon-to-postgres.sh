#!/usr/bin/env bash
# One-time full data transfer: Neon → host Postgres (not Docker).
#
# Prerequisites:
#   - ./deploy/scripts/install-host-postgres.sh already run
#   - /opt/visa/.env with NEON_DATABASE_URL, POSTGRES_*
#
# Usage:
#   ./deploy/scripts/neon-to-postgres.sh
#   SKIP_DUMP=1 DUMP_FILE=/opt/visa/neon.dump ./deploy/scripts/neon-to-postgres.sh

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
POSTGRES_USER="${POSTGRES_USER:-visa}"
POSTGRES_DB="${POSTGRES_DB:-visa_db}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "${NEON_DATABASE_URL:-}" ]] || [[ "${SKIP_DUMP:-0}" == "1" ]] \
  || die "Set NEON_DATABASE_URL in .env (or SKIP_DUMP=1 with an existing DUMP_FILE)"

pg_isready -h 127.0.0.1 -p 5432 >/dev/null \
  || die "Host Postgres not ready — run deploy/scripts/install-host-postgres.sh first"

if [[ "${SKIP_DUMP:-0}" != "1" ]]; then
  echo "==> Dumping Neon to $DUMP_FILE"
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

echo "==> Restoring into host Postgres ($POSTGRES_DB)"
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-acl \
  "$DUMP_FILE" \
  || echo "WARN: pg_restore exited non-zero — continuing with sanity checks"

echo "==> Sanity checks"
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
echo "OK: Restore finished on host Postgres."
echo "DATABASE_URL should use host.docker.internal (see deploy/env.production.example)."
