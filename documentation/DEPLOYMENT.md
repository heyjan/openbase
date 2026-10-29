# Openbase Deployment on Existing AWS Docker Host

This runbook is for the current AWS setup where:
- the main compose project lives in `/opt/docker/environment`,
- Openbase is cloned to `/opt/docker/environment/openbase`,
- an existing `postgres:17.10` service (`postgres`) already runs in the shared compose stack.

This guide intentionally focuses only on what is still needed for Openbase rollout.

---

## 1) Prepare Openbase environment file

Run from the host:

```bash
cd /opt/docker/environment
cp -n openbase/.env.example openbase/.env
```

Generate independent encryption and shared-link session secrets. Run this command
twice and use a different result for each setting:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `openbase/.env` and set at least:

```env
NODE_ENV=production
DATABASE_URL=postgres://openbase_app:<STRONG_PASSWORD>@postgres:5432/openbase

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...

OPENBASE_ENCRYPTION_KEY=<first-generated-64-char-hex>
OPENBASE_SHARE_LINK_SESSION_SECRET=<second-generated-64-char-hex>
```

Notes:
- `DATABASE_URL` must point to the existing `postgres` service (not `db`).
- `SMTP_*` and `OPENBASE_ENCRYPTION_KEY` are required in production startup checks.
- Replace both secret placeholders with generated values. Never deploy the literal
  values from `.env.example`. The shared-link session secret signs access cookies;
  rotating it invalidates existing shared-link sessions.

---

## 2) Integrate Openbase service into existing `/opt/docker/environment/docker-compose.yml`

Do **not** copy the Openbase `db` service from the repository compose file.
Only add the Openbase app service to your existing compose under `services:`.

```yaml
  openbase:
    build:
      context: ./openbase
      dockerfile: Dockerfile
      pull: true
      no_cache: true
    restart: unless-stopped
    env_file:
      - ./openbase/.env
    depends_on:
      - postgres
    expose:
      - "3000"
    networks:
      - router
    labels:
      - wud.watch=true
```

`router` already exists in the current AWS compose; keep using it so Nginx Proxy Manager can reach `openbase:3000`.

---

## 3) Create Openbase database and user in the existing Postgres 17.10 container

Run from `/opt/docker/environment`:

```bash
cd /opt/docker/environment
```

Create role:

```bash
docker compose exec -T postgres bash -lc \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c \"CREATE ROLE openbase_app WITH LOGIN PASSWORD '<STRONG_PASSWORD>';\""
```

Create database:

```bash
docker compose exec -T postgres bash -lc \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c \"CREATE DATABASE openbase OWNER openbase_app;\""
```

Grant privileges:

```bash
docker compose exec -T postgres bash -lc \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c \"GRANT ALL PRIVILEGES ON DATABASE openbase TO openbase_app;\""
```

If role/database already exists, skip the corresponding command and continue.

---

## 4) Import Openbase schema

From `/opt/docker/environment`:

```bash
docker compose exec -T postgres psql -U openbase_app -d openbase < openbase/db/schema.sql
```

Quick verification:

```bash
docker compose exec -T postgres psql -U openbase_app -d openbase -c "\dt"
```

---

## 5) Build and start Openbase

```bash
cd /opt/docker/environment
docker compose build --pull --no-cache openbase
docker compose up -d --no-deps openbase
docker compose exec -T openbase node --version
docker compose logs --tail=150 openbase
```

Expected: Nuxt/Nitro startup logs with no `DATABASE_URL`, SMTP, or encryption-key errors.

---

## 6) Route traffic via existing Nginx Proxy Manager

In Nginx Proxy Manager, create/update the proxy host:
- **Forward Hostname / IP:** `openbase`
- **Forward Port:** `3000`
- **Scheme:** `http`

TLS/domain handling stays in your already-running proxy setup.

---

## 7) First deployment validation checklist

- `docker compose ps openbase` shows `Up`.
- `docker compose logs openbase` has no startup validation errors.
- `\dt` in `openbase` database shows tables from `db/schema.sql`.
- Openbase setup/login flow works and magic-link emails are sent.

---

## 8) Update / redeploy process

```bash
cd /opt/docker/environment/openbase
git pull

cd /opt/docker/environment
docker compose build --pull --no-cache openbase
docker compose up -d --no-deps openbase
docker compose exec -T openbase node --version
docker compose logs --tail=150 openbase
```

The production Dockerfile tracks `node:24-slim`, not an exact Node patch or
`node:latest`. Every release must refresh base images and rebuild before replacing
the container. An image pull alone does not update Node in an already-built
application image. These commands do not update a running application automatically
when a new upstream patch is published.

If deploying the Python AI service as well, rebuild it with `--pull --no-cache`
and recreate its service. Run `python security_check.py` inside that container
to verify the incident-specific version floors and absence of LiteLLM.

For Docker Hub deployments, the image publisher must perform the fresh build,
verify and scan it, and push a new release tag. The AWS host then pulls and deploys
that application tag. Keep the prior application tag available for rollback.

See [Container security updates](container-security-updates.md) for the eMudhra
certificate incident requirements and verification commands.
