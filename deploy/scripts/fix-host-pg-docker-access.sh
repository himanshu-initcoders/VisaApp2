#!/usr/bin/env bash
# Allow Docker containers (host.docker.internal) to reach host Postgres.
# docker0 host-gateway is 172.17.0.1; compose bridges are usually 172.16.0.0/12.
set -euo pipefail

PG_CONF=/etc/postgresql/18/main/postgresql.conf
PG_HBA=/etc/postgresql/18/main/pg_hba.conf

[[ -f "$PG_CONF" ]] || { echo "Missing $PG_CONF"; exit 1; }

echo "==> Listen on all interfaces (UFW still blocks public 5432)"
sed -i "s/^#\\?listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"

if ! grep -q 'visa docker networks' "$PG_HBA"; then
  cat >> "$PG_HBA" <<'EOF'

# visa docker networks (host.docker.internal / compose bridges)
host    all    all    127.0.0.1/32    scram-sha-256
host    all    all    172.16.0.0/12   scram-sha-256
EOF
fi

echo "==> UFW: allow Docker private ranges to 5432; deny public"
if command -v ufw >/dev/null 2>&1; then
  ufw allow from 172.16.0.0/12 to any port 5432 proto tcp || true
  ufw allow from 192.168.0.0/16 to any port 5432 proto tcp || true
  ufw deny 5432/tcp || true
  ufw status | grep 5432 || true
fi

systemctl restart postgresql
sleep 2
ss -tlnp | grep 5432 || true

echo "==> Probe from container via host.docker.internal"
docker run --rm --add-host=host.docker.internal:host-gateway postgres:18-alpine \
  pg_isready -h host.docker.internal -p 5432 -t 5

echo "OK"
