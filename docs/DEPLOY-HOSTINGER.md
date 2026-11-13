# Deploy: Hostinger KVM + Docker + Postgres + Jenkins

Same-VPS stack: **Next.js app**, **Postgres 16**, **Caddy (HTTPS)**, **Jenkins** (localhost only).

Uploads stay on **S3** (`UPLOAD_PROVIDER=s3`). Only the database moves off Neon.

## Architecture

- `db` — Postgres 18, volume `pgdata` mounted at `/var/lib/postgresql` (18+ image layout), published as `127.0.0.1:5432` only
- `app` — Next.js standalone (`Dockerfile` target `runner`)
- `migrate` — Drizzle migrate image (Compose profile `migrate`)
- `caddy` — ports 80/443, auto TLS for `DOMAIN`
- `jenkins` — `127.0.0.1:8080`, Docker socket for compose deploys

## 0. VPS prerequisites

1. Hostinger **KVM / VPS** with SSH (prefer **4GB+ RAM**).
2. Point domain **A record** to the VPS public IP.
3. Firewall: allow **22, 80, 443**. Do **not** expose 5432 or 8080 publicly.
4. Install Docker Engine + Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# re-login, then:
docker compose version
```

5. Note Docker group GID for Jenkins:

```bash
getent group docker | cut -d: -f3
```

## 1. First clone on the server

```bash
sudo mkdir -p /opt/visa
sudo chown "$USER":"$USER" /opt/visa
git clone <YOUR_REPO_URL> /opt/visa
cd /opt/visa
cp deploy/env.production.example .env
nano .env   # fill secrets, DOMAIN, POSTGRES_*, DATABASE_URL, AWS, etc.
```

Set at minimum:

| Variable | Example |
|----------|---------|
| `DOMAIN` | `app.example.com` |
| `CADDY_EMAIL` | Let’s Encrypt contact |
| `NEXTAUTH_URL` | `https://app.example.com` |
| `POSTGRES_PASSWORD` | strong secret |
| `DATABASE_URL` | `postgresql://visa:PASSWORD@db:5432/visa_db` |
| `DOCKER_GID` | from `getent group docker` |
| `NEON_DATABASE_URL` | current Neon URL (**temporary**, for dump only) |

## 2. Neon → Docker Postgres (one-time)

```bash
cd /opt/visa
chmod +x deploy/scripts/neon-to-postgres.sh
docker compose up -d db
./deploy/scripts/neon-to-postgres.sh
```

What it does:

1. `pg_dump` Neon (custom format) → `neon.dump`
2. `pg_restore` into the `db` container
3. Prints row counts for `users`, `visa_applications`, `passport_services`, drizzle migrations

**Do not** run `db:migrate` immediately after a successful restore — schema + `drizzle.__drizzle_migrations` are already in the dump.

Smoke-test after bringing the app up (next section): login + open one visa/passport application.

Then treat Neon as read-only for a few days and remove `NEON_DATABASE_URL` from `.env`.

Restore-only (dump already on disk):

```bash
SKIP_DUMP=1 DUMP_FILE=/opt/visa/neon.dump ./deploy/scripts/neon-to-postgres.sh
```

## 3. Start the stack

```bash
cd /opt/visa
docker compose up -d --build db app caddy jenkins
curl -fsS http://127.0.0.1:3000/api/health   # may fail until app is up; use:
docker compose exec -T app curl -fsS http://127.0.0.1:3000/api/health
```

Public check: `https://YOUR_DOMAIN/api/health`

### Jenkins UI (SSH tunnel only)

```bash
ssh -L 8080:127.0.0.1:8080 user@YOUR_VPS_IP
```

Browser: `http://127.0.0.1:8080`

1. Unlock with password from:

   ```bash
   docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```

2. Create admin user; confirm Docker Pipeline / Git / Credentials plugins (image preinstalls common ones).
3. New Item → **Pipeline**
   - Definition: **Pipeline script from SCM**
   - SCM: Git → your repo
   - Script path: `Jenkinsfile`
4. Add GitHub webhook (or poll SCM) to trigger on push to `main`.

Pipeline stages: sync workspace → `/opt/visa` (keeps `.env`) → build → migrate → deploy → health.

## 4. Ongoing deploys

- Push to the watched branch, or **Build Now** in Jenkins.
- Migrations run via `docker compose --profile migrate run --rm migrate`.
- App recreate is probed at `/api/health`.

Manual deploy without Jenkins:

```bash
cd /opt/visa
git pull
# NEXT_PUBLIC_* are baked in at image build (compose passes them from .env)
docker compose build app migrate
docker compose --profile migrate run --rm migrate
docker compose up -d app caddy
```

After changing `NEXT_PUBLIC_RAZORPAY_KEY_ID` or `NEXT_PUBLIC_TINYMCE_API_KEY`, rebuild the app image (restart alone is not enough).

## 5. Cutover checklist

- [ ] DNS A record → VPS
- [ ] `.env` filled; `DATABASE_URL` uses host `db`
- [ ] Neon dump restored; row counts look right
- [ ] `UPLOAD_PROVIDER=s3` and AWS keys work
- [ ] `NEXTAUTH_URL` / Razorpay webhook URL use the new HTTPS domain
- [ ] Firewall: 22/80/443 only
- [ ] Jenkins only via SSH tunnel
- [ ] Login + one application smoke test
- [ ] Remove `NEON_DATABASE_URL` after stable cutover
- [ ] Keep Neon read-only briefly as rollback

## 6. Useful commands

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose exec db psql -U visa -d visa_db
```

## 7. Rollback notes

- **App only**: redeploy previous git SHA via Jenkins / `git checkout` + compose build.
- **DB**: restore from a fresh `pg_dump` of Docker Postgres, or temporarily point `DATABASE_URL` back at Neon (app container must reach Neon — use the Neon URL directly, host not `db`).

## Files

| Path | Role |
|------|------|
| `Dockerfile` | `deps` / `builder` / `migrate` / `runner` |
| `docker-compose.yml` | Full stack |
| `Caddyfile` | TLS + reverse proxy |
| `Jenkinsfile` | CI/CD |
| `deploy/env.production.example` | Env template |
| `deploy/scripts/neon-to-postgres.sh` | Neon transfer |
| `deploy/jenkins/Dockerfile` | Jenkins + Docker CLI |
| `app/api/health/route.ts` | Deploy probe |
