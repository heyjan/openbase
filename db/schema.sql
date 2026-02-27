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

CREATE TABLE IF NOT EXISTS app_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  tags          TEXT[],
  share_token   VARCHAR(64) UNIQUE,
  is_active     BOOLEAN DEFAULT true,
  grid_config   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id   UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  token          VARCHAR(64) UNIQUE NOT NULL,
  label          VARCHAR(255),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  view_count     INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_links_dashboard_id ON share_links(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_share_links_active_dashboard ON share_links(is_active, dashboard_id);

CREATE TABLE IF NOT EXISTS modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(255),
  config        JSONB NOT NULL,
  query_visualization_id UUID,
  grid_x        INT NOT NULL DEFAULT 0,
  grid_y        INT NOT NULL DEFAULT 0,
  grid_w        INT NOT NULL DEFAULT 6,
  grid_h        INT NOT NULL DEFAULT 5,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  connection    JSONB NOT NULL,
  connection_encrypted BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'data_sources'
      AND column_name = 'connection_encrypted'
  ) THEN
    ALTER TABLE data_sources
    ADD COLUMN connection_encrypted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS editor_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS editor_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_user_id  UUID REFERENCES editor_users(id) ON DELETE CASCADE,
  session_token   VARCHAR(128) UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS writable_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id  UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  table_name      VARCHAR(255) NOT NULL,
  allowed_columns TEXT[],
  allow_insert    BOOLEAN DEFAULT true,
  allow_update    BOOLEAN DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_source_id, table_name)
);

CREATE TABLE IF NOT EXISTS editor_table_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_user_id    UUID NOT NULL REFERENCES editor_users(id) ON DELETE CASCADE,
  writable_table_id UUID NOT NULL REFERENCES writable_tables(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(editor_user_id, writable_table_id)
);

CREATE TABLE IF NOT EXISTS editor_dashboard_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_user_id  UUID NOT NULL REFERENCES editor_users(id) ON DELETE CASCADE,
  dashboard_id    UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(editor_user_id, dashboard_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID,
  actor_type VARCHAR(20) NOT NULL,
  action     VARCHAR(100) NOT NULL,
  resource   VARCHAR(255),
  details    JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);

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

CREATE TABLE IF NOT EXISTS query_visualizations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_query_id UUID NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  module_type    VARCHAR(50) NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'modules_query_visualization_id_fkey'
  ) THEN
    ALTER TABLE modules
    ADD CONSTRAINT modules_query_visualization_id_fkey
    FOREIGN KEY (query_visualization_id)
    REFERENCES query_visualizations(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_query_visualizations_saved_query_id
ON query_visualizations(saved_query_id);

CREATE INDEX IF NOT EXISTS idx_modules_query_visualization_id
ON modules(query_visualization_id);

CREATE TABLE IF NOT EXISTS ingestion_pipeline_runs (
  id           VARCHAR(36) PRIMARY KEY,
  pipeline     VARCHAR(64) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  message      TEXT,
  row_count    INTEGER,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  triggered_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_runs_pipeline_started
ON ingestion_pipeline_runs (pipeline, started_at DESC);

CREATE TABLE IF NOT EXISTS annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID REFERENCES dashboards(id) ON DELETE CASCADE,
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
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  share_link_id UUID REFERENCES share_links(id) ON DELETE SET NULL,
  share_token  VARCHAR(64),
  accessed_at  TIMESTAMPTZ DEFAULT now(),
  ip_address   INET,
  user_agent   TEXT
);

ALTER TABLE dashboards
ALTER COLUMN share_token DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_log'
      AND column_name = 'share_link_id'
  ) THEN
    ALTER TABLE access_log
    ADD COLUMN share_link_id UUID REFERENCES share_links(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO share_links (dashboard_id, token, is_active, created_at, updated_at)
SELECT d.id, d.share_token, true, d.created_at, d.updated_at
FROM dashboards d
WHERE d.share_token IS NOT NULL
ON CONFLICT (token) DO NOTHING;

UPDATE access_log a
SET share_link_id = sl.id
FROM share_links sl
WHERE a.share_link_id IS NULL
  AND a.dashboard_id = sl.dashboard_id
  AND a.share_token = sl.token;

WITH share_stats AS (
  SELECT
    sl.id AS share_link_id,
    COUNT(a.id)::INTEGER AS view_count,
    MAX(a.accessed_at) AS last_viewed_at
  FROM share_links sl
  LEFT JOIN access_log a
    ON a.dashboard_id = sl.dashboard_id
   AND (
     a.share_link_id = sl.id
     OR (a.share_link_id IS NULL AND a.share_token = sl.token)
   )
  GROUP BY sl.id
)
UPDATE share_links sl
SET
  view_count = share_stats.view_count,
  last_viewed_at = share_stats.last_viewed_at
FROM share_stats
WHERE sl.id = share_stats.share_link_id;

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
  annotation_id  UUID REFERENCES annotations(id) ON DELETE SET NULL,
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
