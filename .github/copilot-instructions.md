# Copilot instructions

## Source of truth
- `spec.md` is the primary reference for architecture, schema, APIs, and module behavior.

## High-level architecture
- Nuxt 4 + Tailwind 4 UI with ECharts; Nitro server routes under `server/api`.
- Public viewer at `/d/[slug]` with share-token access; admin UI under `/admin/*` using nuxt-auth credentials.
- PostgreSQL for app + forecast data; data sources expose saved, parameterized queries.
- Python sidecar workers handle forecast/actuals ingestion, outlier detection, and forecast accuracy.

## Key paths (planned structure)
- `app/pages/` (viewer + admin pages), `components/modules/` (one component per module type).
- `components/dashboard/` (grid, editor, module config panel, global filters).
- `composables/` (module data fetch, dashboard CRUD, grid layout, admin auth).
- `server/api/` (public + admin endpoints), `server/middleware/` (share-token + admin auth).
- `server/utils/data-source-adapters/` (postgresql + rest API adapters), `types/` for domain types.

## Key conventions
- Share links: `/d/:slug?token=:share_token`; viewers have no login, admin APIs are `/api/admin/*`.
- Saved queries use named parameters like `:asin`; never interpolate SQL strings.
- Module `config` is JSONB and validated by module-specific JSON schema; schema drives admin config UI.
- Grid layout is 12 columns; module layout uses `grid_x/y/w/h`.
- Module data loads client-side on dashboard render with optional `refresh_interval` and cache TTL.
- Outlier status values: `new`, `acknowledged`, `acted_on`, `dismissed`.

## Data model highlights
- Core tables: `dashboards`, `modules`, `data_sources`, `saved_queries`, `annotations`.
- Forecast tables: `amazon_forecast_snapshots`, `amazon_actuals`, `forecast_outliers`, `products`.
