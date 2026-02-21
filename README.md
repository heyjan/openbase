# Openbase

**Status:** Alpha — this project is under active development and may change without notice.

Openbase is an open-source data analytics and business intelligence platform.

It started from frustration with Metabase limitations, and evolved into a flexible alternative focused on modular dashboards, data source integrations, and practical admin workflows.

## What’s included

- Guided admin setup (magic link + password) on first run.
- Admin management with session-based authentication.
- Dashboard editor with configurable modules and previews.
- Data sources with a browser for tables/collections and rows.
- SQLite and MongoDB connectors (more providers planned).

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

   Apply the schema in `db/schema.sql` if you are not using Docker.

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Using data sources

- **SQLite:** Provide a local file path on the data sources page.
- **MongoDB:** Provide a connection URI and database name; collections are listed and browsable.

## Optional ingestion worker webhooks

Manual pipeline triggers in `/admin/ingestion` can call external workers if webhook URLs are configured.

- `INGESTION_WEBHOOK_BASE_URL`: Base URL used as `<base>/<pipeline-id>`.
- `INGESTION_WEBHOOK_AMAZON_FORECAST_URL`: Override URL for `amazon-forecast`.
- `INGESTION_WEBHOOK_AMAZON_ACTUALS_URL`: Override URL for `amazon-actuals`.
- `INGESTION_WEBHOOK_FORECAST_OUTLIERS_URL`: Override URL for `forecast-outliers`.
- `INGESTION_WEBHOOK_TIMEOUT_MS`: Request timeout (default `30000`).

Worker responses may include `{ "message": "...", "rowCount": 123 }` for ingestion run logs.
