#!/usr/bin/env bash
set -euo pipefail

echo "==> Reset 5432 UFW rules; allow Docker ranges only"
# Delete matching rules by scanning numbers high→low
mapfile -t nums < <(ufw status numbered | grep '5432' | sed -n 's/^\[\s*\([0-9]\+\).*/\1/p' | sort -nr)
for n in "${nums[@]:-}"; do
  yes | ufw delete "$n" >/dev/null || true
done

ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
ufw allow from 192.168.0.0/16 to any port 5432 proto tcp
# Do NOT add a public allow for 5432 — default deny covers the internet
ufw reload
ufw status verbose | grep -E '5432|Default' || true

echo "==> Probe host.docker.internal:5432 from container"
docker run --rm --add-host=host.docker.internal:host-gateway postgres:18-alpine \
  pg_isready -h host.docker.internal -p 5432 -t 5

echo "==> Probe 172.17.0.1:5432"
docker run --rm postgres:18-alpine pg_isready -h 172.17.0.1 -p 5432 -t 5

echo "==> Probe host network 127.0.0.1"
docker run --rm --network host postgres:18-alpine pg_isready -h 127.0.0.1 -p 5432 -t 5

echo OK
