<p align="center">
  <img src="public/brain-icon-7087186-512.png" alt="Openbase Logo" width="120" />
</p>

# Openbase


**Status:** Alpha — this project is under active development and may change without notice.

Openbase is an open-source data analytics and business intelligence platform.

It started from frustration with Metabase limitations, and evolved into a flexible alternative focused on modular dashboards, data source integrations, and practical admin workflows.

## Release Plan

Current milestone: **v0.1 stabilization** (**March 2026**).

### Deployment progress

- Deployment spec moved to `documentation/DEPLOYMENT.md`.
- Completed from deployment spec:
  - Step 1: `.env`-driven configuration and `.env.example` template.
  - Step 2: setup flow now confirms magic-link delivery and production SMTP is fail-fast validated.
  - Step 3: production multi-stage `Dockerfile` added.
  - Step 6 (Security): stronger security headers and production encryption-key requirement.
- Pending by plan: reverse proxy/TLS and production compose rollout steps.

### Recently completed

- Editor RBAC with separate editor auth/session handling.
- Controlled PostgreSQL write flows via admin-managed writable tables.
- MySQL and DuckDB data source support (read-only adapters), alongside PostgreSQL/SQLite/MongoDB.
- Security hardening (input sanitization, security headers, request rate limiting, audit logging).
- Optional encryption at rest for data source connection settings.

### Next planned feature

- **AI Chat-assisted dashboarding**:
  - User provides a natural-language request.
  - LLM selects the most suitable saved query/query input.
  - LLM recommends and configures the best-fit visualization/module type.

## What’s included

- Guided admin setup (magic link + password) on first run.
- Admin management with session-based authentication.
- Editor RBAC with separate editor users/sessions and scoped dashboard access.
- Controlled PostgreSQL data entry via admin-defined writable tables (INSERT/UPDATE).
- Dashboard editor with drag/resize canvas and configurable modules.
- Configurable text modules (`header`, `subheader`) for sectioning.
- Data sources with a browser for tables/collections and rows.
- PostgreSQL, MySQL, DuckDB, SQLite, and MongoDB connectors.
- Public dashboard sharing with tokenized links.
- PDF export for shared dashboards.
- Audit logging for auth and editor write actions.

## Quick start (Docker)

```bash
cp .env.example .env
podman compose up --build
```

Then open `http://localhost:3000` and complete the setup flow on first run.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set required environment variables (recommended via `.env`):

   ```bash
   cp .env.example .env
   ```

   If not using `.env`, export at least:

   ```bash
   export DATABASE_URL=postgres://openbase:password@localhost:5432/openbase

   # Required in production
   export SMTP_HOST=smtp.example.com
   export SMTP_USER=noreply@example.com
   export SMTP_PASS=your-smtp-password
   export OPENBASE_ENCRYPTION_KEY=your-64-char-hex-key

   # Optional
   export OPENBASE_DATA_DIR=/workspace
   ```

   Generate `OPENBASE_ENCRYPTION_KEY` (64-char hex) with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # or
   openssl rand -hex 32
   ```

   Apply the schema in `db/schema.sql` if you are not using Docker.

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Before opening a PR, run:

   ```bash
   npm run build
   ```

5. Run end-to-end tests (Playwright):

   ```bash
   npm run test:e2e
   ```

## Using data sources

- **PostgreSQL:** URI or host/user/database credentials. Supports query execution, table browsing, and writable-table workflows.
- **MySQL:** URI or host/user/database credentials. Read-only querying and table browsing.
- **DuckDB:** File path (or `:memory:`). Read-only mode with path validation under `OPENBASE_DATA_DIR`.
- **SQLite:** Local file path. Read-only mode with path validation under `OPENBASE_DATA_DIR`.
- **MongoDB:** Connection URI and database name; collections are listed and browsable.

## RBAC & Editor Writes

- Admins manage editors at `/admin/editors`.
- Admins define writable PostgreSQL tables at `/admin/writable-tables`.
- Admins assign dashboard/table permissions per editor.
- Editors sign in at `/editor/login`, access assigned dashboards at `/editor`, and edit permitted table cells directly inside `/editor/dashboards/{slug}`.

## Security hardening

- Recursive API input sanitization for request payloads.
- Security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`).
- In-memory sliding-window rate limiting for login/admin/write/public routes.
- AES-256-GCM encryption for data source connection settings (`OPENBASE_ENCRYPTION_KEY` required in production).
- Audit log tracking for login/logout and editor write events.
