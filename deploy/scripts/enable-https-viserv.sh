#!/usr/bin/env bash
# Point Caddy at viserv.in / www and obtain Let's Encrypt certs.
set -euo pipefail
cd /opt/visa

test -f Caddyfile
test -f .env

echo "==> Update production env for HTTPS domain"
# DOMAIN is unused by new Caddyfile site names but keep it consistent
sed -i 's|^DOMAIN=.*|DOMAIN=viserv.in|' .env
sed -i 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://viserv.in|' .env
if grep -q '^CADDY_EMAIL=' .env; then
  sed -i 's|^CADDY_EMAIL=.*|CADDY_EMAIL=hello@viserv.in|' .env
else
  echo 'CADDY_EMAIL=hello@viserv.in' >> .env
fi
grep -E '^(DOMAIN|NEXTAUTH_URL|CADDY_EMAIL)=' .env
chmod 600 .env
chown 1000:1000 .env

echo "==> Recreate Caddy + app (pick up env + Caddyfile)"
docker compose up -d --force-recreate --no-build caddy app
sleep 8
docker compose ps
docker compose logs --tail=40 caddy

echo "==> Probe HTTP→HTTPS and health"
curl -sI http://viserv.in/api/health | head -15 || true
curl -sI https://viserv.in/api/health | head -15 || true
curl -sI https://www.viserv.in/api/health | head -15 || true
curl -fsS https://viserv.in/api/health
echo
curl -fsS https://www.viserv.in/api/health
echo
echo OK
