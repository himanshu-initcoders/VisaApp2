#!/usr/bin/env bash
set -euo pipefail
cd /opt/visa
set -a
# shellcheck disable=SC1091
source .env
set +a
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "==> Restore dump"
pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-acl \
  /opt/visa/docker-db.dump || echo "WARN: pg_restore non-zero"

echo "==> Counts"
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS t, COUNT(*)::bigint AS rows FROM users
UNION ALL
SELECT 'visa_applications', COUNT(*)::bigint FROM visa_applications
UNION ALL
SELECT 'passport_services', COUNT(*)::bigint FROM passport_services;
SQL

echo "==> Point DATABASE_URL at host.docker.internal"
sed -i 's#@db:5432/#@host.docker.internal:5432/#' .env
# Also fix if already localhost
sed -i 's#@127\.0\.0\.1:5432/#@host.docker.internal:5432/#' .env
sed -i 's#@localhost:5432/#@host.docker.internal:5432/#' .env
grep '^DATABASE_URL=' .env | sed 's/:[^:@]*@/:***@/'
chmod 600 .env
chown 1000:1000 .env

echo "==> Recreate app + caddy with new compose"
docker compose up -d --force-recreate app caddy
sleep 5
docker compose exec -T app curl -fsS http://127.0.0.1:3000/api/health || true
docker compose ps
echo DONE
