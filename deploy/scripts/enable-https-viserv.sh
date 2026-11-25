#!/usr/bin/env bash
# Point Caddy at viserv.in / www and obtain Let's Encrypt certs.
# Canonical host is www; apex permanently redirects.
set -euo pipefail
cd /opt/visa

test -f Caddyfile
test -f .env

echo "==> Update production env for HTTPS domain (www canonical)"
# DOMAIN is unused by new Caddyfile site names but keep it consistent
sed -i 's|^DOMAIN=.*|DOMAIN=viserv.in|' .env
sed -i 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://www.viserv.in|' .env
if grep -q '^NEXT_PUBLIC_APP_URL=' .env; then
  sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://www.viserv.in|' .env
else
  echo 'NEXT_PUBLIC_APP_URL=https://www.viserv.in' >> .env
fi
if grep -q '^WA_MEDIA_PUBLIC_BASE_URL=' .env; then
  sed -i 's|^WA_MEDIA_PUBLIC_BASE_URL=.*|WA_MEDIA_PUBLIC_BASE_URL=https://www.viserv.in|' .env
fi
if grep -q '^CADDY_EMAIL=' .env; then
  sed -i 's|^CADDY_EMAIL=.*|CADDY_EMAIL=hello@viserv.in|' .env
else
  echo 'CADDY_EMAIL=hello@viserv.in' >> .env
fi
grep -E '^(DOMAIN|NEXTAUTH_URL|NEXT_PUBLIC_APP_URL|WA_MEDIA_PUBLIC_BASE_URL|CADDY_EMAIL)=' .env || true
chmod 600 .env
chown 1000:1000 .env

echo "==> Recreate Caddy + app (pick up env + Caddyfile)"
docker compose up -d --force-recreate --no-build caddy app
sleep 8
docker compose ps
docker compose logs --tail=40 caddy

echo "==> Probe HTTP→HTTPS, apex→www redirect, and health"
curl -sI http://viserv.in/api/health | head -15 || true
curl -sI https://viserv.in/api/health | head -15 || true
curl -sI https://www.viserv.in/api/health | head -15 || true
# Apex should 301 to www; www should serve the app
curl -fsS https://www.viserv.in/api/health
echo
echo OK
