<p align="center">
  <img src="public/brain-icon-7087186-512.png" alt="Openbase Logo" width="120" />
</p>

# Openbase


**Status:** Alpha — this project is under active development and may change without notice.

Openbase is an open-source data analytics and business intelligence platform.

It started from frustration with Metabase limitations, and evolved into a flexible alternative focused on modular dashboards, data source integrations, and practical admin workflows.

## Release Plan

Target for **Release v0.1**: **March 1, 2026**.

### v0.1 scope (in progress)

- Configurable text blocks on dashboards: **Header** and **Subheader** modules.
- **PDF export** for public shared dashboards (`/d/[slug]?token=...`).
- **Resizable dashboard canvas** with GridStack-based drag/resize editing.

### Next planned feature (post-v0.1)

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
docker-compose up --build
```

Then open `http://localhost:3000` and complete the setup flow on first run.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set the database URL (PostgreSQL required for the app metadata):

   ```bash
   export DATABASE_URL=postgres://postgres:postgres@localhost:5432/openbase
   ```

   Optional environment variables:

   ```bash
   # Required to encrypt data source connection configs at rest
   export OPENBASE_ENCRYPTION_KEY=your-32-byte-key

   # Base directory for SQLite/DuckDB files (defaults to process cwd)
   export OPENBASE_DATA_DIR=/workspace
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

## RBAC & Data Entry

- Admins manage editors at `/admin/editors`.
- Admins define writable PostgreSQL tables at `/admin/writable-tables`.
- Admins assign dashboard/table permissions per editor.
- Editors sign in at `/editor/login`, access assigned dashboards at `/editor`, and perform data entry at `/editor/data-entry`.

## Security hardening

- Recursive API input sanitization for request payloads.
- Security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- In-memory sliding-window rate limiting for login/admin/write/public routes.
- Optional AES-256-GCM encryption for data source connection settings (`OPENBASE_ENCRYPTION_KEY`).
- Audit log tracking for login/logout and editor write events.

## Optional ingestion worker webhooks

Manual pipeline triggers in `/admin/ingestion` can call external workers if webhook URLs are configured.

- `INGESTION_WEBHOOK_BASE_URL`: Base URL used as `<base>/<pipeline-id>`.
- `INGESTION_WEBHOOK_AMAZON_FORECAST_URL`: Override URL for `amazon-forecast`.
- `INGESTION_WEBHOOK_AMAZON_ACTUALS_URL`: Override URL for `amazon-actuals`.
- `INGESTION_WEBHOOK_FORECAST_OUTLIERS_URL`: Override URL for `forecast-outliers`.
- `INGESTION_WEBHOOK_TIMEOUT_MS`: Request timeout (default `30000`).

Worker responses may include `{ "message": "...", "rowCount": 123 }` for ingestion run logs.
