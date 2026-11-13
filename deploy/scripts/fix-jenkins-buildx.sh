#!/usr/bin/env bash
set -euo pipefail
cd /opt/visa

echo "==> Install buildx into running Jenkins container (if present)"
if docker ps --format '{{.Names}}' | grep -qx visa-jenkins-1; then
  docker exec -u root visa-jenkins-1 bash -lc '
    apt-get update -qq
    apt-get install -y -qq docker-buildx-plugin
    docker buildx version
  '
else
  echo "Jenkins container not running yet"
fi

echo "==> Rebuild Jenkins image (includes buildx) and recreate"
docker compose build jenkins
docker compose up -d jenkins
sleep 10
docker exec -u root visa-jenkins-1 docker buildx version
echo "OK: Jenkins has buildx"
