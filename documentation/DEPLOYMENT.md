# Openbase Deployment on Existing AWS Docker Host

This runbook is for the current AWS setup where:
- the main compose project lives in `/opt/docker/environment`,
- Openbase is cloned to `/opt/docker/environment/openbase`,
- an existing `postgres:17.9` service (`postgres`) already runs in the shared compose stack.

This guide intentionally focuses only on what is still needed for Openbase rollout.

---

## 1) Prepare Openbase environment file

Run from the host:

```bash
cd /opt/docker/environment
cp -n openbase/.env.example openbase/.env
```

Generate encryption key:

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

OPENBASE_ENCRYPTION_KEY=<64-char-hex>
```

Notes:
- `DATABASE_URL` must point to the existing `postgres` service (not `db`).
- `SMTP_*` and `OPENBASE_ENCRYPTION_KEY` are required in production startup checks.

---

## 2) Integrate Openbase service into existing `/opt/docker/environment/docker-compose.yml`

Do **not** copy the Openbase `db` service from the repository compose file.
Only add the Openbase app service to your existing compose under `services:`.

```yaml
  openbase:
    build:
      context: ./openbase
      dockerfile: Dockerfile
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

## 3) Create Openbase database and user in the existing Postgres 17.9 container

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
docker compose up -d --build openbase
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
docker compose up -d --build openbase
```
