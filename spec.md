# Demand Forecasting Dashboard — Technical Specification

**Version:** 0.1 — Draft
**Stack:** Nuxt 4 · Tailwind 4 · ECharts · PostgreSQL · Nitro

---

## 1. Problem Statement

We are an Amazon Vendor (1P) and multi-channel brand. Amazon accounts for ~60% of our German market. We ship worldwide across multiple channels (B2B + B2C).

Amazon provides weekly demand forecasts (Mean, P70, P80, P90) for a rolling 26-week window — but only shows the *current* forecast. Historical snapshots are lost unless archived. Our production lead time is ~8 weeks, making weekly granularity too short for production decisions without aggregation and trend analysis.

**We need a tool that:**
- Archives weekly Amazon forecast snapshots and builds a historical dataset
- Visualizes forecast timelines with confidence bands (P-levels)
- Detects and surfaces outliers that signal production adjustments
- Aggregates forecasts into production-relevant time windows (8+ weeks)
- Is extensible to other data sources (warehouse stock via Evidenza, pricing via Idealo scraper, other sales channels)
- Is shareable with non-technical colleagues without requiring user accounts
- Eventually this tool will evolve to a more customizable open source version of Metabase

---

## 2. Core Concepts

### 2.1 Dashboards
A **Dashboard** is a named collection of **Modules** arranged in a responsive grid. Dashboards are the primary unit of sharing.

- Each dashboard has a unique `slug` and a `share_token`
- Anyone with the share link (`/d/:slug?token=:share_token`) can view the dashboard — no login required
- Only admins can create, edit, or delete dashboards
- Dashboards can be tagged/grouped (e.g. "Forecasting", "Warehouse", "Pricing")

### 2.2 Modules (Widgets)
A **Module** is a self-contained visualization or data component placed on a dashboard. Inspired by Metabase's card system.

Each module has:
- A **type** (chart, table, KPI card, form, annotation log)
- A **data source** configuration (which query/endpoint feeds it)
- **Display settings** (chart options, colors, title, size)
- **Grid position** (x, y, width, height in a 12-column grid)
- Optional **filters** that can be linked across modules on the same dashboard

### 2.3 Data Sources
A **Data Source** is a configured connection to a data backend. Initially:

| Source ID       | Description                          | Type        |
|-----------------|--------------------------------------|-------------|
| `amazon-forecast` | Weekly forecast snapshots from VC   | PostgreSQL  |
| `amazon-actuals`  | Actual sales data from VC           | PostgreSQL  |
| `idealo-pricing`  | Idealo price scraper (existing in SQlite)     | PostgreSQL  |
| `evidenza-stock`  | Warehouse stock levels (4 sites)    | REST API    |

Data sources are admin-configured. New sources can be added without code changes (for SQL-based sources) or with a small adapter (for API-based sources).

### 2.4 Share Links
The access model replaces traditional user login:

- **Admin access:** Single admin interface, protected by password or environment-based auth (e.g. IP allowlist + simple password). Not publicly accessible.
- **Viewer access:** Dashboards are accessed via share links containing a token. No login, no accounts. Tokens can be rotated/revoked from the admin panel.
- **Optional:** Expiring links, view-count limits (future)

---

## 3. Module Types

### 3.1 Time Series Chart
**Purpose:** Visualize forecast data, actuals, and trends over time.

ECharts line/area chart with:
- Multiple series (Mean, P70, P80, P90 as confidence bands)
- Actual sales overlay (when available)
- Data zoom (brush select, scroll zoom) for navigating the 26-week window
- Tooltip synced across series
- Click-to-annotate: click a data point → open annotation form
- Outlier markers: points flagged by outlier detection highlighted in a distinct color

**Config options:**
- ASIN / product group filter
- P-level selection (which bands to show)
- Time range (trailing N weeks, next N weeks, custom)
- Aggregation period (weekly, 4-week, 8-week rolling)
- Show/hide actuals overlay

### 3.2 Outlier Table
**Purpose:** Surface forecast anomalies ranked by business impact.

Sortable, filterable table showing:
- Product (ASIN, title, thumbnail)
- Outlier direction (▲ spike / ▼ drop)
- Magnitude (% deviation from rolling average)
- Volume impact (absolute unit delta)
- Priority score (magnitude × volume importance)
- Status: New / Acknowledged / Acted On
- Annotation field (editable — the "why")

**Config options:**
- Sensitivity threshold (σ multiplier or % deviation)
- Time window for rolling average baseline
- Product group filter
- Status filter

### 3.3 KPI Card
**Purpose:** Single number with context at a glance.

Displays:
- Current value (large)
- Comparison value (vs. last week / last year / target)
- Trend indicator (▲▼ with color)
- Sparkline (optional, last 8-12 data points)

**Example KPIs:**
- Forecast Accuracy (MAPE) this month
- Total units forecasted next 8 weeks
- Number of active outliers
- Warehouse X stock level
- Idealo price position vs. competitors

**Config options:**
- Data source + query/metric
- Comparison period
- Thresholds for color coding (green/amber/red)
- Display format (number, percentage, currency)

### 3.4 Data Table
**Purpose:** Tabular view of any data source with sorting, filtering, search.

Paginated table with:
- Column visibility toggle
- Sort by any column
- Filter bar (text search, range, select)
- CSV export button
- Optional inline sparklines in cells

**Config options:**
- Data source + query
- Column selection and ordering
- Default sort
- Rows per page

### 3.5 Annotation Log
**Purpose:** Chronological record of manual notes tied to products and dates.

Displays:
- Timeline of annotations
- Each entry: date, product(s), author name (free text), note text, tags
- Filter by product, date range, tag

**Also serves as the input form for annotations — dual purpose: display + data entry.**

### 3.6 Form / Data Input (Future)
**Purpose:** Allow colleagues to enter data manually (e.g. planned promotions, production decisions, manual overrides).

- Configurable fields
- Writes to a PostgreSQL table
- Can trigger recalculation of derived metrics

---

## 4. Admin Dashboard

The admin interface is the back-office for managing everything. It is NOT shared via links — it's a separate authenticated area.

### 4.1 Dashboard Manager
- List all dashboards (name, slug, module count, last modified, share status)
- Create new dashboard (name, slug, description, tags)
- Edit dashboard: opens the **Dashboard Editor**
- Delete dashboard (with confirmation)
- Generate / rotate / revoke share tokens
- Copy share link to clipboard
- Preview as viewer

### 4.2 Dashboard Editor
Visual grid editor for composing dashboards:

- 12-column responsive grid
- Drag to add modules from a sidebar palette
- Drag to reposition modules
- Resize modules by dragging edges
- Click a module to open its **Module Config Panel**
- Module Config Panel: type-specific settings (see Section 3)
- Save / discard changes
- Live preview toggle

**Grid system:**
- Built on CSS Grid (Tailwind)
- Minimum module size: 3 columns × 2 rows
- Auto-stacking on mobile (single column)
- Named breakpoints: desktop (12-col), tablet (6-col), mobile (1-col)

### 4.3 Data Source Manager
- List configured data sources
- Add new data source:
  - **SQL:** connection string, test connection, optional default schema
  - **REST API:** base URL, auth headers, polling interval
- Edit / delete data sources
- Query editor: write and test SQL queries, preview results (for SQL-based sources)
- Saved queries: reusable named queries that modules can reference

### 4.4 Module Template Library
- List of saved module configurations (templates)
- Save current module config as template
- Apply template to new module (pre-fills settings)
- Useful for standardization: e.g. "Standard Forecast Chart" template that every product dashboard uses

### 4.5 Ingestion Status
- Status of data pipelines (last run, success/failure, row counts)
- Manual trigger for re-ingestion
- Log viewer for pipeline errors

### 4.6 Share Link Manager
- List all active share links across all dashboards
- Bulk revoke
- Usage stats (view count, last accessed) — optional/future

---

## 5. Viewer Dashboard (Share Link)

What a colleague or stakeholder sees when opening a share link.

### 5.1 Layout
- Clean, read-only view of the dashboard
- Dashboard title + description at top
- Modules rendered in the configured grid layout
- Global filter bar at top (if dashboard has shared filters, e.g. product group, date range)

### 5.2 Interactions (read-only)
- Chart zoom, pan, tooltip hover
- Table sort, filter, search, CSV export
- Click through outlier table to see detail
- View annotations
- **Add annotations** (no login — just a name field + note text)

### 5.3 No Interactions
- Cannot add/remove/resize modules
- Cannot change data source config
- Cannot access admin panel
- Cannot see other dashboards (unless they have the link)

---

## 6. Database Schema (PostgreSQL)

### 6.1 Application Tables

```sql
-- Admin users (credentials-based auth via nuxt-auth)
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,   -- bcrypt hashed
  name          VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Dashboards
CREATE TABLE dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  tags          TEXT[],
  share_token   VARCHAR(64) UNIQUE NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  grid_config   JSONB,           -- responsive breakpoint overrides
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Modules (widgets on a dashboard)
CREATE TABLE modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,  -- 'time_series_chart', 'outlier_table', 'kpi_card', etc.
  title         VARCHAR(255),
  config        JSONB NOT NULL,        -- type-specific configuration
  grid_x        INT NOT NULL DEFAULT 0,
  grid_y        INT NOT NULL DEFAULT 0,
  grid_w        INT NOT NULL DEFAULT 6, -- out of 12 columns
  grid_h        INT NOT NULL DEFAULT 4, -- row units
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Data Sources
CREATE TABLE data_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) NOT NULL,  -- 'postgresql', 'rest_api', 'python_script'
  connection    JSONB NOT NULL,        -- encrypted connection details
  is_active     BOOLEAN DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Saved Queries (reusable by modules)
CREATE TABLE saved_queries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  query_text    TEXT NOT NULL,          -- SQL query or API endpoint config
  parameters    JSONB,                  -- parameterized query definitions
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Module Templates
CREATE TABLE module_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  config        JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Annotations (manual notes tied to products/dates)
CREATE TABLE annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id),
  asin          VARCHAR(20),
  product_group VARCHAR(255),
  event_date    DATE,
  author_name   VARCHAR(255),          -- free text, no login
  note          TEXT NOT NULL,
  tags          TEXT[],                 -- e.g. 'promo', 'stockout', 'seasonal', 'competitor'
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Share Link Access Log (optional)
CREATE TABLE access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id),
  share_token   VARCHAR(64),
  accessed_at   TIMESTAMPTZ DEFAULT now(),
  ip_address    INET,
  user_agent    TEXT
);
```

### 6.2 Forecast Data Tables

```sql
-- Amazon forecast snapshots (archived weekly)
CREATE TABLE amazon_forecast_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE NOT NULL,         -- when we captured this forecast
  asin            VARCHAR(20) NOT NULL,
  product_title   VARCHAR(500),
  brand           VARCHAR(255),
  product_group   VARCHAR(255),          -- custom grouping
  forecast_week   DATE NOT NULL,         -- the week being forecasted
  mean            NUMERIC(10,2),
  p70             NUMERIC(10,2),
  p80             NUMERIC(10,2),
  p90             NUMERIC(10,2),
  UNIQUE(snapshot_date, asin, forecast_week)
);

CREATE INDEX idx_forecast_asin ON amazon_forecast_snapshots(asin);
CREATE INDEX idx_forecast_snapshot ON amazon_forecast_snapshots(snapshot_date);
CREATE INDEX idx_forecast_week ON amazon_forecast_snapshots(forecast_week);

-- Actual sales (weekly aggregated)
CREATE TABLE amazon_actuals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      DATE NOT NULL,
  asin            VARCHAR(20) NOT NULL,
  product_title   VARCHAR(500),
  brand           VARCHAR(255),
  product_group   VARCHAR(255),
  units_sold      NUMERIC(10,2),
  revenue         NUMERIC(12,2),
  UNIQUE(week_start, asin)
);

-- Computed outliers (populated by Python detection job)
CREATE TABLE forecast_outliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at     TIMESTAMPTZ DEFAULT now(),
  asin            VARCHAR(20) NOT NULL,
  product_title   VARCHAR(500),
  forecast_week   DATE NOT NULL,
  outlier_type    VARCHAR(20),           -- 'spike', 'drop', 'trend_break'
  direction       VARCHAR(10),           -- 'up', 'down'
  magnitude_pct   NUMERIC(8,2),          -- % deviation from baseline
  absolute_delta  NUMERIC(10,2),         -- unit difference
  priority_score  NUMERIC(8,2),          -- magnitude × volume weight
  baseline_value  NUMERIC(10,2),         -- what was expected
  actual_value    NUMERIC(10,2),         -- what forecast shows
  p_level_used    VARCHAR(10),           -- which P-level triggered detection
  status          VARCHAR(20) DEFAULT 'new', -- 'new', 'acknowledged', 'acted_on', 'dismissed'
  annotation_id   UUID REFERENCES annotations(id),
  UNIQUE(asin, forecast_week, p_level_used)
);

-- Product master (for enrichment)
CREATE TABLE products (
  asin            VARCHAR(20) PRIMARY KEY,
  title           VARCHAR(500),
  brand           VARCHAR(255),
  product_group   VARCHAR(255),          -- your custom grouping
  category        VARCHAR(255),
  is_active       BOOLEAN DEFAULT true,
  avg_weekly_volume NUMERIC(10,2),       -- for priority scoring
  production_lead_days INT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. API Design (Nitro Server Routes)

### 7.1 Public API (Viewer — token-authenticated)

```
GET  /api/dashboards/:slug?token=:share_token
     → Dashboard config + module list

GET  /api/dashboards/:slug/modules/:moduleId/data?token=:token&filters=...
     → Query results for a specific module (runs saved query with filters)

POST /api/dashboards/:slug/annotations?token=:token
     → Create annotation { asin, event_date, author_name, note, tags }
```

### 7.2 Admin API (password/session-authenticated)

```
# Dashboards
GET    /api/admin/dashboards
POST   /api/admin/dashboards
PUT    /api/admin/dashboards/:id
DELETE /api/admin/dashboards/:id
POST   /api/admin/dashboards/:id/rotate-token
GET    /api/admin/dashboards/:id/preview

# Modules
GET    /api/admin/dashboards/:id/modules
POST   /api/admin/dashboards/:id/modules
PUT    /api/admin/modules/:id
DELETE /api/admin/modules/:id
PUT    /api/admin/dashboards/:id/modules/layout    → batch update grid positions

# Data Sources
GET    /api/admin/data-sources
POST   /api/admin/data-sources
PUT    /api/admin/data-sources/:id
DELETE /api/admin/data-sources/:id
POST   /api/admin/data-sources/:id/test            → test connection

# Saved Queries
GET    /api/admin/queries
POST   /api/admin/queries
PUT    /api/admin/queries/:id
DELETE /api/admin/queries/:id
POST   /api/admin/queries/:id/preview               → run query, return first 100 rows

# Module Templates
GET    /api/admin/templates
POST   /api/admin/templates
DELETE /api/admin/templates/:id

# Ingestion
GET    /api/admin/ingestion/status
POST   /api/admin/ingestion/trigger/:pipeline

# Share Links
GET    /api/admin/share-links
DELETE /api/admin/share-links/:token
```

---

## 8. Nuxt 4 Application Structure

```
app/
├── pages/
│   ├── index.vue                          # Landing / redirect
│   ├── d/
│   │   └── [slug].vue                     # Viewer dashboard (public, token in query)
│   └── admin/
│       ├── index.vue                      # Dashboard list
│       ├── dashboards/
│       │   ├── new.vue                    # Create dashboard
│       │   └── [id]/
│       │       ├── edit.vue               # Dashboard grid editor
│       │       └── share.vue              # Share link management
│       ├── data-sources/
│       │   ├── index.vue                  # List & manage
│       │   └── [id].vue                   # Edit data source
│       ├── queries/
│       │   ├── index.vue                  # Saved query list
│       │   └── [id].vue                   # Query editor with preview
│       ├── templates.vue                  # Module template library
│       └── ingestion.vue                  # Pipeline status
│
├── components/
│   ├── modules/                           # One component per module type
│   │   ├── ModuleRenderer.vue             # Dynamic module loader (switch on type)
│   │   ├── TimeSeriesChart.vue
│   │   ├── OutlierTable.vue
│   │   ├── KpiCard.vue
│   │   ├── DataTable.vue
│   │   ├── AnnotationLog.vue
│   │   └── FormInput.vue
│   ├── dashboard/
│   │   ├── DashboardGrid.vue              # Grid layout renderer
│   │   ├── DashboardEditor.vue            # Admin drag-and-drop editor
│   │   ├── ModuleConfigPanel.vue          # Slide-out config editor
│   │   ├── ModulePalette.vue              # Sidebar palette for adding modules
│   │   └── GlobalFilterBar.vue            # Shared filters across modules
│   ├── admin/
│   │   ├── QueryEditor.vue                # SQL editor with preview
│   │   ├── DataSourceForm.vue
│   │   └── ShareLinkManager.vue
│   └── ui/                                # Shared UI primitives (Tailwind-based)
│       ├── Card.vue
│       ├── Button.vue
│       ├── Modal.vue
│       ├── Dropdown.vue
│       ├── Badge.vue
│       ├── Table.vue
│       └── Spinner.vue
│
├── composables/
│   ├── useModuleData.ts                   # Fetch data for a module (handles caching, refresh)
│   ├── useDashboard.ts                    # Load/save dashboard config
│   ├── useGridLayout.ts                   # Grid position management
│   ├── useOutliers.ts                     # Outlier-specific logic
│   ├── useAnnotations.ts                  # CRUD for annotations
│   └── useAdminAuth.ts                    # Simple admin authentication
│
├── server/
│   ├── api/
│   │   ├── dashboards/
│   │   │   ├── [slug].get.ts              # Public: get dashboard by slug+token
│   │   │   └── [slug]/
│   │   │       ├── modules/
│   │   │       │   └── [moduleId]/
│   │   │       │       └── data.get.ts    # Public: module data endpoint
│   │   │       └── annotations.post.ts    # Public: create annotation
│   │   └── admin/
│   │       ├── dashboards/                # Full CRUD
│   │       ├── modules/                   # Full CRUD
│   │       ├── data-sources/              # Full CRUD + test
│   │       ├── queries/                   # Full CRUD + preview
│   │       ├── templates/                 # Full CRUD
│   │       ├── ingestion/                 # Status + trigger
│   │       └── share-links/               # List + revoke
│   ├── middleware/
│   │   ├── admin-auth.ts                  # Verify admin session/password
│   │   └── share-token.ts                 # Verify share token for public routes
│   ├── utils/
│   │   ├── db.ts                          # PostgreSQL connection (pg or postgres.js)
│   │   ├── query-runner.ts                # Execute saved queries with parameters
│   │   └── data-source-adapters/
│   │       ├── postgresql.ts
│   │       └── rest-api.ts
│   └── plugins/
│       └── db.ts                          # Initialize DB connection on startup
│
├── types/
│   ├── dashboard.ts
│   ├── module.ts
│   ├── data-source.ts
│   ├── forecast.ts
│   └── outlier.ts
│
└── assets/
    └── css/
        └── main.css                       # Tailwind 4 entry point
```

---

## 9. Key Technical Decisions

### 9.1 Grid Layout Library
Use **`vue-grid-layout`** (or a Nuxt 4 compatible fork) for the admin drag-and-drop editor. For the viewer, render a plain CSS Grid — no need for the drag library on public dashboards.

### 9.2 ECharts Integration
Use **`vue-echarts`** v7+ with Nuxt. Import chart types on demand (tree-shaking) to keep bundle size reasonable. Wrap in a `<ClientOnly>` component since ECharts needs the DOM.

### 9.3 SQL Query Safety
Saved queries are **parameterized templates** — not raw user SQL. Admin writes queries with named parameters like `WHERE asin = :asin AND week >= :start_date`. The query runner substitutes values safely (parameterized queries via pg). **Never** interpolate values into SQL strings.

### 9.4 Admin Authentication
Using **`@sidebase/nuxt-auth`** with the credentials provider:
- Two admin accounts configured via environment variables or seeded in DB
- Login page at `/admin/login`
- JWT session stored in HTTP-only cookie
- All `/api/admin/*` routes protected by server middleware checking valid session
- Viewer routes (`/d/:slug`) do NOT require auth — only share token validation

Can be upgraded to OAuth/SSO later if the team grows.

### 9.5 Data Refresh Strategy
- Module data is fetched client-side when the dashboard loads
- Each module has a configurable `refresh_interval` (default: none for historical data, 5min for live data)
- Admin can set per-module cache TTL
- Forecast data is inherently weekly — no need for real-time refresh

### 9.6 Module Config Schema
Each module type defines a JSON schema for its `config` field. This enables:
- Validation when saving module config
- Auto-generating the config form in the admin editor
- Type-safe access in the rendering component

Example for `time_series_chart`:
```json
{
  "saved_query_id": "uuid",
  "filters": {
    "asin": { "type": "select", "multi": true },
    "date_range": { "type": "date_range", "default": "next_26_weeks" }
  },
  "series": [
    { "field": "mean", "label": "Mean", "color": "#3B82F6", "type": "line" },
    { "field": "p70", "label": "P70", "color": "#3B82F6", "opacity": 0.3, "type": "area" },
    { "field": "p80", "label": "P80", "color": "#F59E0B", "opacity": 0.2, "type": "area" },
    { "field": "p90", "label": "P90", "color": "#EF4444", "opacity": 0.1, "type": "area" }
  ],
  "actuals_overlay": true,
  "outlier_markers": true,
  "aggregation": "weekly",
  "enable_zoom": true
}
```

---

## 10. Python Services (Sidecar)

### 10.1 Forecast Ingestion Worker
- Runs weekly (cron or triggered from admin)
- Reads forecast CSV (manually uploaded or pulled via Amazon SP-API)
- Parses ASIN, product title, brand, weekly forecast columns for each P-level
- Inserts into `amazon_forecast_snapshots` with current date as `snapshot_date`
- Upserts into `products` table for any new ASINs

### 10.2 Actuals Ingestion Worker
- Runs weekly
- Imports actual sales data (from VC Business Reports or SP-API)
- Inserts into `amazon_actuals`

### 10.3 Outlier Detection Worker
- Runs after each forecast ingestion
- For each ASIN, compares new forecast values to rolling baseline (configurable window, default 4 weeks)
- Detection methods:
  - Z-score on week-over-week change (flag if > 2σ)
  - Percentage deviation from rolling mean (flag if > 20%)
  - Trend break detection (sudden direction change)
- Calculates priority score: `magnitude_pct × avg_weekly_volume`
- Inserts into `forecast_outliers` table
- Optionally sends notification (email, Slack webhook) for high-priority outliers

### 10.4 Forecast Accuracy Calculator
- Runs weekly (once actuals for a past week are available)
- Compares what each P-level predicted N weeks ago vs. what actually sold
- Calculates per-ASIN, per-P-level:
  - MAPE (Mean Absolute Percentage Error)
  - Bias (over-forecast vs. under-forecast tendency)
  - Accuracy by forecast horizon (1-week-ahead, 4-week-ahead, 8-week-ahead)
- Stores in a `forecast_accuracy` table for dashboarding

---

## 11. Implementation Phases

### Phase 1 — Foundation (Weeks 1–2)
**Deliverables:** Data pipeline + basic dashboard viewing

- [ ] Set up Nuxt 4 project with Tailwind 4, ECharts, PostgreSQL
- [ ] Create database schema (all tables above)
- [ ] Build Python forecast ingestion worker (CSV → PostgreSQL)
- [ ] Build Python actuals ingestion worker
- [ ] Build admin auth (simple password)
- [ ] Admin: Dashboard CRUD (list, create, edit name/slug, delete)
- [ ] Admin: Generate and manage share tokens
- [ ] Viewer: Render dashboard by slug+token (static layout for now)
- [ ] First module: **KPI Card** (simplest to implement)
- [ ] First data: Manually import 1-2 weeks of forecast CSVs

### Phase 2 — Core Modules (Weeks 3–4)
**Deliverables:** Forecast visualization + outlier detection live

- [ ] Module: **Time Series Chart** with P-level bands + actuals overlay
- [ ] Module: **Outlier Table** with status management
- [ ] Module: **Data Table** (generic)
- [ ] Build Python outlier detection worker
- [ ] Build Python forecast accuracy calculator
- [ ] Admin: Saved query editor with preview
- [ ] Admin: Module config panel (type-specific settings)
- [ ] Wire up global filter bar (product group, date range)

### Phase 3 — Dashboard Editor (Weeks 5–6)
**Deliverables:** Drag-and-drop dashboard composition

- [ ] Admin: Grid editor with drag-and-drop module placement
- [ ] Admin: Module palette (add from sidebar)
- [ ] Admin: Resize modules
- [ ] Admin: Module template library (save/apply)
- [ ] Module: **Annotation Log** with input form
- [ ] Click-to-annotate on Time Series Chart
- [ ] Responsive layout (desktop → tablet → mobile)

### Phase 4 — Extensions (Weeks 7–8)
**Deliverables:** Multi-source data, polish

- [ ] Data source manager (add/edit/test connections)
- [ ] REST API adapter (for Evidenza warehouse stock)
- [ ] Connect Idealo pricing data (existing PostgreSQL)
- [ ] Module: **Form Input** (manual data entry)
- [ ] Ingestion status dashboard
- [ ] Access logging for share links
- [ ] Email/Slack alerts for high-priority outliers
- [ ] Performance optimization (query caching, lazy module loading)

### Phase 5 — Future Enhancements
- Expiring share links / view-count limits
- Dashboard duplication / templating
- Comparison dashboards (Product A vs. Product B)
- 8-week production planning view (aggregated, actionable)
- Multi-marketplace support (DE, UK, FR, etc.)
- Forecast accuracy leaderboard (which P-level is best per product)
- Custom Python notebook integration for ad-hoc analysis

---

## 12. Non-Functional Requirements

| Area            | Requirement                                           |
|-----------------|-------------------------------------------------------|
| Performance     | Dashboard load < 2s for up to 10 modules              |
| Data freshness  | Forecast data updated weekly, stock data every 5min    |
| Browser support | Chrome, Firefox, Safari (latest 2 versions)            |
| Mobile          | Responsive — modules stack to single column            |
| Hosting         | Self-hosted (Docker) or any Node.js-capable platform   |
| Backup          | PostgreSQL daily backup                                |
| Security        | Admin password hashed, share tokens are crypto-random  |
| Scalability     | Supports up to ~5,000 ASINs, 2 years of weekly data   |

---

## 13. Resolved Questions

1. **Data ingestion:** Primary source is Evidenza (where Amazon data already lands). Backup/fallback is a CSV importer for manual uploads. Both paths write to the same PostgreSQL tables.
2. **Evidenza integration:** To be determined — need connection details (REST API, DB, or export). Architecture supports all three via data source adapters.
3. **Marketplace:** Amazon DE only for v1. Schema supports marketplace field for future expansion.
4. **Notifications:** Not in scope for v1. Can be added later via webhook/email.
5. **Hosting:** AWS. Existing infrastructure uses nginx + docker-compose. We need a local dev docker-compose. Production deployment integrates with existing AWS nginx setup.
6. **Scale:** ~4,000 products total, ~400 active on Amazon. System must be scalable to full catalog. DB schema and queries are designed for 5,000+ ASINs with 2+ years of weekly data.
7. **Admin users:** Two admins. Using **Nuxt Auth Module** (sidebase/nuxt-auth) with credentials provider. No viewer login — share links only.
8. **Dev environment:** Devcontainer setup with full Docker isolation. Claude Code yolo mode safe — all processes run inside containers, no host filesystem access beyond project mount, no ability to damage anything outside the dev environment.

## 14. Open Questions

1. **Evidenza connection details:** REST API endpoint? Direct DB connection? CSV/SFTP export? (Needed for data source adapter implementation)
2. **Amazon forecast CSV format:** Need a sample CSV to build the parser. Column names, date formats, P-level structure.
3. **Actual sales data source:** Also from Evidenza, or separate export from Vendor Central?
