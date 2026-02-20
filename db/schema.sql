CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(128) UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_magic_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  tags          TEXT[],
  share_token   VARCHAR(64) UNIQUE NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  grid_config   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(255),
  config        JSONB NOT NULL,
  grid_x        INT NOT NULL DEFAULT 0,
  grid_y        INT NOT NULL DEFAULT 0,
  grid_w        INT NOT NULL DEFAULT 6,
  grid_h        INT NOT NULL DEFAULT 4,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  connection    JSONB NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_queries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  query_text     TEXT NOT NULL,
  parameters     JSONB,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS module_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  config     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id),
  asin          VARCHAR(20),
  product_group VARCHAR(255),
  event_date    DATE,
  author_name   VARCHAR(255),
  note          TEXT NOT NULL,
  tags          TEXT[],
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards(id),
  share_token  VARCHAR(64),
  accessed_at  TIMESTAMPTZ DEFAULT now(),
  ip_address   INET,
  user_agent   TEXT
);

CREATE TABLE IF NOT EXISTS amazon_forecast_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  asin          VARCHAR(20) NOT NULL,
  product_title VARCHAR(500),
  brand         VARCHAR(255),
  product_group VARCHAR(255),
  forecast_week DATE NOT NULL,
  mean          NUMERIC(10, 2),
  p70           NUMERIC(10, 2),
  p80           NUMERIC(10, 2),
  p90           NUMERIC(10, 2),
  UNIQUE(snapshot_date, asin, forecast_week)
);

CREATE INDEX IF NOT EXISTS idx_forecast_asin ON amazon_forecast_snapshots(asin);
CREATE INDEX IF NOT EXISTS idx_forecast_snapshot ON amazon_forecast_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_forecast_week ON amazon_forecast_snapshots(forecast_week);

CREATE TABLE IF NOT EXISTS amazon_actuals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start    DATE NOT NULL,
  asin          VARCHAR(20) NOT NULL,
  product_title VARCHAR(500),
  brand         VARCHAR(255),
  product_group VARCHAR(255),
  units_sold    NUMERIC(10, 2),
  revenue       NUMERIC(12, 2),
  UNIQUE(week_start, asin)
);

CREATE TABLE IF NOT EXISTS forecast_outliers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at    TIMESTAMPTZ DEFAULT now(),
  asin           VARCHAR(20) NOT NULL,
  product_title  VARCHAR(500),
  forecast_week  DATE NOT NULL,
  outlier_type   VARCHAR(20),
  direction      VARCHAR(10),
  magnitude_pct  NUMERIC(8, 2),
  absolute_delta NUMERIC(10, 2),
  priority_score NUMERIC(8, 2),
  baseline_value NUMERIC(10, 2),
  actual_value   NUMERIC(10, 2),
  p_level_used   VARCHAR(10),
  status         VARCHAR(20) DEFAULT 'new',
  annotation_id  UUID REFERENCES annotations(id),
  UNIQUE(asin, forecast_week, p_level_used)
);

CREATE TABLE IF NOT EXISTS products (
  asin                VARCHAR(20) PRIMARY KEY,
  title               VARCHAR(500),
  brand               VARCHAR(255),
  product_group       VARCHAR(255),
  category            VARCHAR(255),
  is_active           BOOLEAN DEFAULT true,
  avg_weekly_volume   NUMERIC(10, 2),
  production_lead_days INT,
  notes               TEXT,
  updated_at          TIMESTAMPTZ DEFAULT now()
);
