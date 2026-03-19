-- Create tables
CREATE TABLE IF NOT EXISTS amazon_rev_ponera (
    id         serial PRIMARY KEY,
    revenue    numeric(15,2) NOT NULL DEFAULT 0,
    month      smallint NOT NULL CHECK (month >= 1 AND month <= 12),
    year       smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS amazon_rev_wol (
    id         serial PRIMARY KEY,
    revenue    numeric(15,2) NOT NULL DEFAULT 0,
    month      smallint NOT NULL CHECK (month >= 1 AND month <= 12),
    year       smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS amazon_rev_opieoils (
    id         serial PRIMARY KEY,
    revenue    numeric(15,2) NOT NULL DEFAULT 0,
    month      smallint NOT NULL CHECK (month >= 1 AND month <= 12),
    year       smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS amazon_rev_arnoldclark (
    id         serial PRIMARY KEY,
    revenue    numeric(15,2) NOT NULL DEFAULT 0,
    month      smallint NOT NULL CHECK (month >= 1 AND month <= 12),
    year       smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (month, year)
);

-- Prefill all tables with months 1-12 for years 2025 and 2026
INSERT INTO amazon_rev_ponera (revenue, month, year)
SELECT 0, m, y FROM generate_series(2025, 2026) AS y, generate_series(1, 12) AS m
ON CONFLICT (month, year) DO NOTHING;

INSERT INTO amazon_rev_wol (revenue, month, year)
SELECT 0, m, y FROM generate_series(2025, 2026) AS y, generate_series(1, 12) AS m
ON CONFLICT (month, year) DO NOTHING;

INSERT INTO amazon_rev_opieoils (revenue, month, year)
SELECT 0, m, y FROM generate_series(2025, 2026) AS y, generate_series(1, 12) AS m
ON CONFLICT (month, year) DO NOTHING;

INSERT INTO amazon_rev_arnoldclark (revenue, month, year)
SELECT 0, m, y FROM generate_series(2025, 2026) AS y, generate_series(1, 12) AS m
ON CONFLICT (month, year) DO NOTHING;
