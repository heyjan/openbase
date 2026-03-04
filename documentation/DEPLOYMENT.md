# Openbase — Production Deployment Spec

## Overview

Openbase is a Nuxt 4 full-stack application backed by PostgreSQL. This document covers every step needed to move from the current development setup to a production-ready deployment.

---

## 1. Environment Variables via `.env` File

**Problem:** Database credentials and secrets are hardcoded in `docker-compose.yml`.

**Solution:** Extract all secrets into a `.env` file that Docker Compose reads automatically.

### Create `.env`

```env
# --- PostgreSQL ---
POSTGRES_USER=openbase
POSTGRES_PASSWORD=<generate-a-strong-password>
POSTGRES_DB=openbase
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

# --- Node ---
NODE_ENV=production

# --- SMTP (required for magic-link emails) ---
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<smtp-password>
SMTP_FROM=noreply@example.com

# --- Encryption (strongly recommended) ---
# 32-byte hex key for AES-256-GCM encryption of data-source credentials at rest
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
OPENBASE_ENCRYPTION_KEY=<64-char-hex-string>

# --- Data directory for SQLite/DuckDB files (optional) ---
# OPENBASE_DATA_DIR=/data
```

### Create `.env.example`

Commit a `.env.example` with placeholder values so new contributors know which variables are required. **Never** commit `.env` itself.

### Update `.gitignore`

```
.env
```

### Update `docker-compose.yml`

Replace hardcoded values with variable references:

```yaml
services:
  app:
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: ${NODE_ENV}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      OPENBASE_ENCRYPTION_KEY: ${OPENBASE_ENCRYPTION_KEY}

  db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
```

---

## 2. Fix Magic Link Email Flow

**Problem:** In production (`NODE_ENV=production`) the server calls `sendMagicLinkEmail()`, but if SMTP is not configured the setup silently fails. In development the magic link is returned in the API response and displayed in the frontend — this must never happen in production.

**Current behavior** (`server/api/setup/start.post.ts:26-31`):

```ts
if (process.env.NODE_ENV === 'production') {
  await sendMagicLinkEmail(email, magicLink)
  return { ok: true }
}
return { ok: true, magicLink }   // ← dev-only shortcut
```

### Required changes

1. **Validate SMTP config at startup in production.** If `NODE_ENV=production` and any of `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are missing, the app should fail fast with a clear error rather than silently breaking the setup flow.

2. **Show a "check your inbox" message in the frontend** instead of waiting for a `magicLink` field. The current setup page (`app/pages/setup/index.vue:68-74`) renders the raw link when present — in production this block is never shown, but the user also gets no feedback that an email was sent. Add a `sent` state that shows a confirmation message regardless of environment.

3. **Ensure SMTP credentials are part of the `.env` template** (covered above).

---

## 3. Production Dockerfile

**Problem:** The current Dockerfile (`.devcontainer/Dockerfile`) is a dev container. It uses a devcontainer base image and includes Playwright system deps — neither belong in production.

### Create a production `Dockerfile`

```dockerfile
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY --from=builder /app/.output .output
COPY --from=builder /app/package.json .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Key points:
- Multi-stage build keeps the final image small (~150 MB vs ~1 GB for devcontainer).
- No dev dependencies or Playwright libs in production.
- Nuxt `npm run build` produces a standalone `.output` directory via Nitro.

---

## 4. Production `docker-compose.prod.yml`

Create a separate compose file for production:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    restart: unless-stopped
    env_file: .env
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    healthcheck:
      test: ["CMD-ONLY", "pg_isready", "-U", "${POSTGRES_USER}"]
      interval: 5s
      retries: 5
    # Do NOT expose port 5432 externally in production

volumes:
  postgres-data:
```

Changes from the dev compose:
- Uses the production Dockerfile (not devcontainer).
- Reads secrets from `.env` file via `env_file`.
- Binds port 3000 to `127.0.0.1` only (reverse proxy handles external traffic).
- Adds a healthcheck on PostgreSQL so the app waits for the DB to be ready.
- Does **not** expose PostgreSQL port 5432 to the host.

---

## 5. Reverse Proxy (TLS Termination)

The Nuxt server should not handle TLS directly. Place a reverse proxy in front of it.

### Option A: Caddy (simplest)

```
# Caddyfile
openbase.example.com {
    reverse_proxy localhost:3000
}
```

Caddy auto-provisions Let's Encrypt certificates.

### Option B: Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name openbase.example.com;

    ssl_certificate     /etc/letsencrypt/live/openbase.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openbase.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name openbase.example.com;
    return 301 https://$host$request_uri;
}
```

---

## 6. Security Hardening

### 6.1 Security Headers

The project currently has **no security headers middleware**. Add a Nitro server middleware that sets:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:;
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 6.2 Encryption Key is Required in Production

`OPENBASE_ENCRYPTION_KEY` is currently optional. In production, data-source credentials (database passwords, API keys) are stored in PostgreSQL — without encryption they sit in plaintext. **Make the encryption key mandatory when `NODE_ENV=production`.**

### 6.3 Session Cookie `secure` Flag

The cookie setup already sets `secure: true` in production — verify this is working once TLS is in place.

### 6.4 Rate Limiting

The in-memory rate limiter (`server/utils/rate-limiter.ts`) works for a single-instance deployment. If you ever scale horizontally, move rate-limit state to Redis.

---

## 7. Database Considerations

### 7.1 Backups

Set up automated PostgreSQL backups:

```bash
# Daily backup via cron
0 3 * * * docker exec openbase-db-1 pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/openbase-$(date +\%F).sql.gz
```

Or use a sidecar container like `prodrigestivill/postgres-backup-local`.

### 7.2 Migrations

The project currently uses a single `schema.sql` for initialization. For ongoing schema changes:
- Consider a migration tool (e.g., `node-pg-migrate`, `dbmate`, or `drizzle-kit`).
- The init script only runs on first container start (empty volume). Schema updates on existing deployments need a migration strategy.

### 7.3 Connection Pooling

For higher load, add PgBouncer between the app and PostgreSQL to pool connections.

---

## 8. Logging and Monitoring

### 8.1 Structured Logging

The app currently uses `console.log`. For production, consider adding a structured logger (e.g., `pino`) to output JSON logs that can be consumed by log aggregation tools.

### 8.2 Health Check Endpoint

Add a `/api/health` endpoint that:
- Returns `200` when the app is running and the DB connection is alive.
- Returns `503` otherwise.
- Used by Docker healthchecks, load balancers, and uptime monitors.

### 8.3 Audit Log Retention

The `audit_log` table grows indefinitely. Set up a retention policy (e.g., delete entries older than 90 days via a scheduled job).

---

## 9. Deployment Checklist

```
Pre-deploy:
  [ ] .env file created with all required variables
  [ ] .env added to .gitignore
  [ ] .env.example committed to repo
  [ ] SMTP credentials tested (send a test email)
  [ ] OPENBASE_ENCRYPTION_KEY generated and set
  [ ] Production Dockerfile created and tested locally
  [ ] docker-compose.prod.yml created

Infrastructure:
  [ ] Server provisioned (min 1 vCPU, 1 GB RAM for small deployments)
  [ ] Domain DNS configured
  [ ] Reverse proxy set up with TLS (Caddy or Nginx + Let's Encrypt)
  [ ] Firewall: only 80, 443 open externally; 3000 and 5432 internal only

Deploy:
  [ ] Clone repo to server
  [ ] Copy .env to server (do NOT commit it)
  [ ] Run: docker compose -f docker-compose.prod.yml up -d --build
  [ ] Verify app is accessible via HTTPS
  [ ] Complete /setup flow — verify magic link arrives via email
  [ ] Verify database encryption is active (check data_sources table)

Post-deploy:
  [ ] Set up automated database backups
  [ ] Set up uptime monitoring (e.g., UptimeRobot, Uptime Kuma)
  [ ] Configure log aggregation if needed
  [ ] Test restore from backup
  [ ] Document the recovery procedure
```

---

## 10. Summary of Required Code Changes

| # | Change | Files |
|---|--------|-------|
| 1 | Move secrets to `.env`, update compose to use `env_file` | `docker-compose.yml`, new `.env.example` |
| 2 | Fix magic link: add "check inbox" UI state, validate SMTP at startup | `server/api/setup/start.post.ts`, `app/pages/setup/index.vue` |
| 3 | Create production Dockerfile (multi-stage build) | new `Dockerfile` |
| 4 | Create production compose file | new `docker-compose.prod.yml` |
| 5 | Add security headers middleware | new `server/middleware/security-headers.ts` |
| 6 | Add health check endpoint | new `server/api/health.get.ts` |
| 7 | Make encryption key mandatory in production | `server/utils/crypto.ts` |
| 8 | Add `.env` to `.gitignore` | `.gitignore` |
