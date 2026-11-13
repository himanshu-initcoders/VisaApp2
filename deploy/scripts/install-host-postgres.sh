#!/usr/bin/env bash
# Install Postgres 18 on the Hostinger host and prepare visa_db for Docker apps
# that connect via host.docker.internal (extra_hosts: host-gateway).
#
# Usage (as root on the VPS):
#   cd /opt/visa && ./deploy/scripts/install-host-postgres.sh
#
# Requires /opt/visa/.env with POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

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
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env}"

die() { echo "ERROR: $*" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || die "Run as root"

echo "==> Installing PostgreSQL 18"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release

if ! command -v psql >/dev/null 2>&1 || ! psql --version | grep -q ' 18'; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-18 postgresql-client-18
fi

systemctl enable --now postgresql

PG_CONF="$(ls /etc/postgresql/18/main/postgresql.conf 2>/dev/null || true)"
PG_HBA="$(ls /etc/postgresql/18/main/pg_hba.conf 2>/dev/null || true)"
[[ -n "$PG_CONF" && -n "$PG_HBA" ]] || die "Postgres 18 config not found under /etc/postgresql/18/main"

echo "==> Listen on localhost + Docker bridge (not the public internet)"
# host.docker.internal (host-gateway) reaches the host via docker0 (often 172.17.0.1)
# '*' so compose-bridge containers can reach host via host.docker.internal (172.17.0.1).
# Public access is blocked by UFW default deny + no public allow on 5432.
sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"

# Allow local socket + loopback + Docker bridge networks
if ! grep -q 'visa docker bridge' "$PG_HBA"; then
  cat >> "$PG_HBA" <<EOF

# visa docker bridge (host.docker.internal)
host    ${POSTGRES_DB}    ${POSTGRES_USER}    127.0.0.1/32    scram-sha-256
host    ${POSTGRES_DB}    ${POSTGRES_USER}    172.16.0.0/12   scram-sha-256
EOF
fi

# Allow Docker private ranges to Postgres; do NOT open 5432 to the public internet.
# (A blanket `ufw deny 5432` breaks host.docker.internal — default deny is enough.)
if command -v ufw >/dev/null 2>&1; then
  ufw allow from 172.16.0.0/12 to any port 5432 proto tcp >/dev/null 2>&1 || true
  ufw allow from 192.168.0.0/16 to any port 5432 proto tcp >/dev/null 2>&1 || true
fi

systemctl restart postgresql
sleep 2

echo "==> Create role + database"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
SQL

# Allow app role to use public schema (PG15+)
sudo -u postgres psql -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};
ALTER SCHEMA public OWNER TO ${POSTGRES_USER};
SQL

echo "==> pg_isready"
pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" || true

echo
echo "OK: Host Postgres 18 ready."
echo "Set in .env:"
echo "  DATABASE_URL=postgresql://${POSTGRES_USER}:***@host.docker.internal:5432/${POSTGRES_DB}"
echo "Then dump Docker DB (if still running) and restore — see docs/DEPLOY-HOSTINGER.md"
