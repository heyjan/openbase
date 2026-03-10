# Revenue Dashboard Visualizations — ECharts Spec

## Context

We have monthly revenue data per country (Deutschland, UK, Iberia, Italy, USA, France, Mexico, NL, Japan, Australia, Saudi Arabia) comparing 2025 vs 2026 with absolute and percentage deviations. The audience is **Directors** — visualizations must be executive-ready: clear, scannable, decision-oriented.

### Currently Available Chart Types
- `time_series_chart` (line/area)
- `bar_chart` (vertical/horizontal, stacked)
- `pie_chart` (pie/donut)
- `scatter_chart` (bubble)

### ECharts Modules Currently Registered
`LineChart`, `BarChart`, `PieChart`, `ScatterChart`, `GridComponent`, `TooltipComponent`, `LegendComponent`, `DatasetComponent`, `CanvasRenderer`

---

## 1. Industry-Standard Visualizations

### 1.1 Grouped Bar Chart — YoY Revenue by Country (per Month)

**Purpose:** Side-by-side comparison of 2025 vs 2026 revenue for each country within a selected month (or all months stacked).

**Chart type:** `bar_chart` (already implemented)

**Configuration:**
- X-axis: country names
- Two series: "2025" and "2026" grouped side-by-side
- Color coding: muted gray for 2025 (prior year), brand blue for 2026 (current year)
- Tooltip showing absolute value + deviation %
- Optional: filter/dropdown to select month

**Why:** The most intuitive executive chart for "how are we doing vs last year." Grouped bars make magnitude and gap immediately visible.

**Implementation:** No new chart type needed — use existing `BarChart.vue` with two series.

---

### 1.2 Multi-Line Time Series — Monthly Revenue Trend per Country

**Purpose:** Show revenue trajectory across months for each country. Overlay 2025 and 2026 lines per country, or show all countries for a single year.

**Chart type:** `time_series_chart` (already implemented)

**Configuration:**
- X-axis: month (1–12)
- One line per country (or per country×year)
- Smooth: true, area: false
- Show symbols for months with data, hide for future months
- Legend at top for country filtering

**Why:** Directors need to see trends, seasonality, and trajectory — not just snapshots. Line charts are the standard for time-based revenue reporting.

**Implementation:** Already supported. Feed the query result with `x_field: 'month'` and one series per country.

---

### 1.3 Horizontal Bar Chart — YoY Growth Ranking

**Purpose:** Rank countries by YoY growth percentage (Abw. %) in a horizontal bar chart. Positive bars go right (green), negative bars go left (red).

**Chart type:** `bar_chart` with `horizontal: true`

**Configuration:**
- Y-axis: country names sorted by growth %
- X-axis: growth percentage
- Color: conditional — green for positive, red for negative
- Data labels showing exact % on each bar

**Why:** Instantly answers "which markets are growing, which are declining?" — the #1 question directors ask. Horizontal orientation makes country labels readable.

**Implementation:** Existing `BarChart.vue` supports `horizontal: true`. **New requirement:** conditional bar coloring based on value sign (positive/negative). This needs a minor enhancement to support `conditional_color` or per-item `itemStyle`.

**ECharts addition needed:** None (BarChart already registered). Code enhancement to support value-based coloring.

---

### 1.4 KPI Cards Row — Top-Level Summary

**Purpose:** Show aggregated headline numbers at the top of the dashboard.

**Cards:**
- **Total Revenue 2026 YTD** (sum of all countries, all months with data)
- **Total Revenue 2025 Same Period** (for comparison)
- **Overall YoY Growth %**
- **Best Performing Country** (name + growth %)
- **Worst Performing Country** (name + growth %)

**Implementation:** Already have `KpiCard` module. Write a summary query feeding these values.

---

### 1.5 Stacked Bar Chart — Revenue Composition by Country

**Purpose:** Show how total monthly revenue is composed across countries, revealing market share shifts.

**Chart type:** `bar_chart` with `stacked: true`

**Configuration:**
- X-axis: month
- Stacked series: one per country
- Color palette: consistent country colors across all charts
- Tooltip: show both absolute value and % of total

**Why:** Shows both total revenue growth AND market mix changes. If total is flat but composition shifts, that's critical intelligence.

**Implementation:** Existing `BarChart.vue` with `stacked: true`.

---

## 2. New Chart Types to Implement

### 2.1 Waterfall Chart — Deviation Breakdown

**Purpose:** Show how each country's YoY change contributes to the overall revenue change. Start with 2025 total, show each country's delta as a rising/falling segment, end at 2026 total.

**Why:** The gold standard for "bridge" analysis in management consulting and board-level reporting. Answers "what drove the change?"

**ECharts support:** Built-in via stacked bar technique (transparent base + colored delta). No new ECharts chart module needed — uses `BarChart` internally with custom series configuration.

**Implementation:**
- Register as new module type: `waterfall_chart`
- Create `WaterfallChart.vue`
- Uses existing `BarChart` from ECharts (no new `use()` registration)
- Series: invisible "base" bar + colored "delta" bar (green up / red down)
- Custom tooltip to show country name, delta, and running total

**Complexity:** Medium. The ECharts pattern for waterfall is well-documented.

---

### 2.2 Heatmap — Country × Month Performance Matrix

**Purpose:** Color-coded grid showing YoY growth % for each country (rows) × month (columns). Green = growth, red = decline, intensity = magnitude.

**Why:** Compact, information-dense view that lets directors spot patterns at a glance — seasonal weakness in specific markets, consistent underperformers, etc.

**ECharts support:** Native `HeatmapChart`.

**Implementation:**
- Register `HeatmapChart` in `EChart.vue`: `import { HeatmapChart } from 'echarts/charts'`
- Also register `VisualMapComponent` for the color gradient legend
- Create `HeatmapChart.vue` as new module type: `heatmap_chart`
- X-axis: month, Y-axis: country, cell color: growth %
- Diverging color scale: red ← white → green (centered at 0%)
- Cell labels showing the exact % value

**Complexity:** Low-medium. ECharts heatmap is straightforward.

**New ECharts registrations:**
```typescript
import { HeatmapChart } from 'echarts/charts'
import { VisualMapComponent } from 'echarts/components'
use([HeatmapChart, VisualMapComponent])
```

---

### 2.3 Gauge Chart — YTD Target Achievement

**Purpose:** Single-value gauge showing overall YTD revenue vs target/budget. Useful if the company has defined revenue targets.

**Why:** Most intuitive "are we on track?" indicator. Directors love gauges for KPI dashboards.

**ECharts support:** Native `GaugeChart`.

**Implementation:**
- Register `GaugeChart` in `EChart.vue`
- Create `GaugeChart.vue` as module type: `gauge_chart`
- Shows percentage of target achieved
- Color zones: red (0-70%), yellow (70-90%), green (90%+)
- Needle pointing to current achievement

**Complexity:** Low.

**New ECharts registration:**
```typescript
import { GaugeChart } from 'echarts/charts'
use([GaugeChart])
```

---

## 3. PostgreSQL Queries

All queries target the `amazon_rev` table with columns: `month` (int), `country` (text), `year` (int), `revenue` (numeric).

### 3.1 Grouped Bar Chart — YoY Revenue by Country (single month or all)

```sql
-- Per-month view: pass month as parameter, or remove WHERE for all months
SELECT
  country,
  COALESCE(SUM(revenue) FILTER (WHERE year = 2025), 0) AS "2025",
  COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0) AS "2026"
FROM amazon_rev
WHERE year IN (2025, 2026)
  -- AND month = :selected_month  -- optional: filter to a single month
GROUP BY country
ORDER BY "2026" DESC;
```

### 3.2 Multi-Line Time Series — Monthly Revenue Trend per Country

```sql
-- One row per month × country, pivoted by year for overlay lines
SELECT
  month,
  country,
  year,
  revenue
FROM amazon_rev
WHERE year IN (2025, 2026)
ORDER BY country, year, month;
```

Alternative — pivoted so each series is a column (one line per country, 2026 only):

```sql
SELECT
  month,
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Deutschland'), 0) AS "Deutschland",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'UK'), 0)          AS "UK",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Iberia'), 0)      AS "Iberia",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Italy'), 0)       AS "Italy",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'USA'), 0)         AS "USA",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'France'), 0)      AS "France",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Mexico'), 0)      AS "Mexico",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'NL'), 0)          AS "NL",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Japan'), 0)       AS "Japan",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Australia'), 0)   AS "Australia",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Saudi Arabia'), 0) AS "Saudi Arabia"
FROM amazon_rev
WHERE year = 2026
GROUP BY month
ORDER BY month;
```

### 3.3 Horizontal Bar Chart — YoY Growth Ranking

```sql
SELECT
  country,
  COALESCE(SUM(revenue) FILTER (WHERE year = 2025), 0) AS rev_2025,
  COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0) AS rev_2026,
  ROUND(
    (COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
     - COALESCE(SUM(revenue) FILTER (WHERE year = 2025), 0))
    / NULLIF(COALESCE(SUM(revenue) FILTER (WHERE year = 2025), 0), 0)
    * 100, 2
  ) AS "growth_pct"
FROM amazon_rev
WHERE year IN (2025, 2026)
  -- Only compare months that have 2026 data
  AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)
GROUP BY country
ORDER BY "growth_pct" DESC;
```

### 3.4 KPI Cards — Top-Level Summary

**Card 1+2+3: Total Revenue & Overall Growth**

```sql
SELECT
  COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0) AS total_rev_2026,
  COALESCE(SUM(revenue) FILTER (WHERE year = 2025
    AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0) AS total_rev_2025_same_period,
  ROUND(
    (COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
     - COALESCE(SUM(revenue) FILTER (WHERE year = 2025
         AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0))
    / NULLIF(COALESCE(SUM(revenue) FILTER (WHERE year = 2025
        AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0), 0)
    * 100, 2
  ) AS overall_yoy_growth_pct
FROM amazon_rev
WHERE year IN (2025, 2026);
```

**Card 4+5: Best & Worst Performing Country**

```sql
WITH country_growth AS (
  SELECT
    country,
    COALESCE(SUM(revenue) FILTER (WHERE year = 2025
      AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0) AS rev_2025,
    COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0) AS rev_2026,
    ROUND(
      (COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
       - COALESCE(SUM(revenue) FILTER (WHERE year = 2025
           AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0))
      / NULLIF(COALESCE(SUM(revenue) FILTER (WHERE year = 2025
          AND month <= (SELECT MAX(month) FROM amazon_rev WHERE year = 2026)), 0), 0)
      * 100, 2
    ) AS growth_pct
  FROM amazon_rev
  WHERE year IN (2025, 2026)
  GROUP BY country
)
SELECT
  MAX(country) FILTER (WHERE growth_pct = (SELECT MAX(growth_pct) FROM country_growth)) AS best_country,
  MAX(growth_pct) AS best_growth_pct,
  MAX(country) FILTER (WHERE growth_pct = (SELECT MIN(growth_pct) FROM country_growth)) AS worst_country,
  MIN(growth_pct) AS worst_growth_pct
FROM country_growth;
```

### 3.5 Stacked Bar Chart — Revenue Composition by Country

```sql
-- Same as 3.2 pivoted query, but for stacked bar we need one column per country
SELECT
  month,
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Deutschland'), 0)  AS "Deutschland",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'UK'), 0)           AS "UK",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Iberia'), 0)       AS "Iberia",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Italy'), 0)        AS "Italy",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'USA'), 0)          AS "USA",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'France'), 0)       AS "France",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Mexico'), 0)       AS "Mexico",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'NL'), 0)           AS "NL",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Japan'), 0)        AS "Japan",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Australia'), 0)    AS "Australia",
  COALESCE(MAX(revenue) FILTER (WHERE country = 'Saudi Arabia'), 0) AS "Saudi Arabia"
FROM amazon_rev
WHERE year = 2026
GROUP BY month
ORDER BY month;
```

### 3.6 Waterfall Chart — Revenue Bridge 2025 → 2026

```sql
WITH max_month AS (
  SELECT MAX(month) AS m FROM amazon_rev WHERE year = 2026
),
country_deltas AS (
  SELECT
    country,
    COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
      - COALESCE(SUM(revenue) FILTER (WHERE year = 2025 AND month <= (SELECT m FROM max_month)), 0)
      AS delta
  FROM amazon_rev
  WHERE year IN (2025, 2026) AND month <= (SELECT m FROM max_month)
  GROUP BY country
),
totals AS (
  SELECT
    SUM(revenue) FILTER (WHERE year = 2025 AND month <= (SELECT m FROM max_month)) AS total_2025,
    SUM(revenue) FILTER (WHERE year = 2026) AS total_2026
  FROM amazon_rev
  WHERE year IN (2025, 2026)
)
-- Row 1: starting point (2025 total)
SELECT 'Total 2025' AS label, total_2025 AS value, 'total' AS bar_type FROM totals
UNION ALL
-- Rows 2–N: country deltas sorted by magnitude
SELECT country, delta, CASE WHEN delta >= 0 THEN 'increase' ELSE 'decrease' END
FROM country_deltas ORDER BY delta DESC
UNION ALL
-- Final row: ending point (2026 total)
SELECT 'Total 2026', total_2026, 'total' FROM totals;
```

### 3.7 Heatmap — Country × Month Growth Matrix

```sql
WITH max_month AS (
  SELECT MAX(month) AS m FROM amazon_rev WHERE year = 2026
)
SELECT
  country,
  month,
  ROUND(
    (COALESCE(MAX(revenue) FILTER (WHERE year = 2026), 0)
     - COALESCE(MAX(revenue) FILTER (WHERE year = 2025), 0))
    / NULLIF(COALESCE(MAX(revenue) FILTER (WHERE year = 2025), 0), 0)
    * 100, 2
  ) AS growth_pct
FROM amazon_rev
WHERE year IN (2025, 2026)
  AND month <= (SELECT m FROM max_month)
GROUP BY country, month
ORDER BY country, month;
```

### 3.8 Gauge Chart — YTD Achievement vs Prior Year

```sql
-- Simple gauge: 2026 YTD as percentage of full-year 2025
-- (use a budget/target table instead if available)
SELECT
  ROUND(
    COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
    / NULLIF(COALESCE(SUM(revenue) FILTER (WHERE year = 2025), 0), 0)
    * 100, 1
  ) AS pct_of_prior_year
FROM amazon_rev
WHERE year IN (2025, 2026);
```

### 3.9 Pie / Donut — Market Share by Country (current year)

```sql
SELECT
  country,
  SUM(revenue) AS revenue
FROM amazon_rev
WHERE year = 2026
GROUP BY country
ORDER BY revenue DESC;
```

### 3.10 Racing Bar Chart — Cumulative Revenue by Month

```sql
-- Returns running totals per country per month (for animated timeline)
SELECT
  month,
  country,
  SUM(revenue) OVER (PARTITION BY country ORDER BY month) AS cumulative_revenue
FROM amazon_rev
WHERE year = 2026
ORDER BY month, cumulative_revenue DESC;
```

### 3.11 Radar Chart — Multi-Dimensional Country Profile

```sql
WITH max_month AS (
  SELECT MAX(month) AS m FROM amazon_rev WHERE year = 2026
),
stats AS (
  SELECT
    country,
    COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0) AS rev_2026,
    ROUND(
      (COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
       - COALESCE(SUM(revenue) FILTER (WHERE year = 2025 AND month <= (SELECT m FROM max_month)), 0))
      / NULLIF(COALESCE(SUM(revenue) FILTER (WHERE year = 2025 AND month <= (SELECT m FROM max_month)), 0), 0)
      * 100, 2
    ) AS growth_pct,
    ROUND(
      COALESCE(SUM(revenue) FILTER (WHERE year = 2026), 0)
      / NULLIF((SELECT SUM(revenue) FROM amazon_rev WHERE year = 2026), 0)
      * 100, 2
    ) AS market_share_pct,
    ROUND(STDDEV(revenue) FILTER (WHERE year = 2026)
      / NULLIF(AVG(revenue) FILTER (WHERE year = 2026), 0)
      * 100, 2
    ) AS volatility_pct  -- lower = more consistent
  FROM amazon_rev
  WHERE year IN (2025, 2026)
    AND month <= (SELECT m FROM max_month)
  GROUP BY country
)
SELECT
  country,
  rev_2026,
  growth_pct,
  market_share_pct,
  -- Invert volatility so higher = better (more stable)
  ROUND(100 - COALESCE(volatility_pct, 0), 2) AS stability_score
FROM stats
ORDER BY rev_2026 DESC;
```

### 3.12 Sankey — Revenue Flow (Region → Country)

```sql
-- Requires a region mapping; here hardcoded for the known countries
WITH region_map(country, region) AS (VALUES
  ('Deutschland', 'Europe'), ('UK', 'Europe'), ('France', 'Europe'),
  ('Iberia', 'Europe'), ('Italy', 'Europe'), ('NL', 'Europe'),
  ('USA', 'Americas'), ('Mexico', 'Americas'),
  ('Japan', 'Asia-Pacific'), ('Australia', 'Asia-Pacific'),
  ('Saudi Arabia', 'Middle East')
)
SELECT
  rm.region,
  r.country,
  SUM(r.revenue) AS revenue
FROM amazon_rev r
JOIN region_map rm ON rm.country = r.country
WHERE r.year = 2026
GROUP BY rm.region, r.country
ORDER BY rm.region, revenue DESC;
```

---

## 4. Recommended Dashboard Layout

For a director-facing revenue dashboard, arrange modules in this order:

```
┌─────────────────────────────────────────────────────────────┐
│  KPI Cards: Total Rev | YoY Growth | Best | Worst Country  │
├─────────────────────────────┬───────────────────────────────┤
│  Multi-Line Time Series     │  Stacked Bar (composition)    │
│  Monthly trend all countries│  Market share over time       │
├─────────────────────────────┼───────────────────────────────┤
│  Grouped Bar                │  Horizontal Bar (growth rank) │
│  2025 vs 2026 by country    │  Countries by YoY %           │
├─────────────────────────────┴───────────────────────────────┤
│  Heatmap: Country × Month growth matrix                     │
├─────────────────────────────────────────────────────────────┤
│  Waterfall: Revenue bridge from 2025 → 2026                 │
├─────────────────────────────────────────────────────────────┤
│  Data Table (existing): Full detail with all columns        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Priority

| Priority | Chart | New Code? | Value |
|----------|-------|-----------|-------|
| P0 | KPI Cards Row | Query only | Immediate executive summary |
| P0 | Grouped Bar (YoY) | No | Core comparison view |
| P0 | Multi-Line Trend | No | Trend visibility |
| P1 | Horizontal Growth Ranking | Minor enhancement | Competitive ranking |
| P1 | Stacked Bar (composition) | No | Market mix insight |
| P1 | Heatmap | New component + ECharts module | Pattern detection |
| P2 | Waterfall Bridge | New component | Board-level storytelling |
| P2 | Gauge (target) | New component + ECharts module | Target tracking |

**P0** = achievable with existing chart types, high director value
**P1** = small to medium effort, strong analytical value
**P2** = new components, impressive but not urgent

---

## 6. Required Code Changes Summary

### No new code (query + config only)
- Grouped Bar, Multi-Line Trend, Stacked Bar, KPI Cards

### Minor enhancement to existing component
- **BarChart.vue:** Support conditional coloring (positive=green, negative=red) via new config property `conditional_color: true`

### New chart components
- `WaterfallChart.vue` — uses existing ECharts BarChart module
- `HeatmapChart.vue` — requires new ECharts HeatmapChart + VisualMapComponent
- `GaugeChart.vue` — requires new ECharts GaugeChart

### EChart.vue registration additions
```typescript
import { HeatmapChart, GaugeChart } from 'echarts/charts'
import { VisualMapComponent } from 'echarts/components'
use([HeatmapChart, GaugeChart, VisualMapComponent])
```

### ModuleRenderer.vue additions
```typescript
waterfall_chart: WaterfallChart,
heatmap_chart: HeatmapChart,
gauge_chart: GaugeChart,
```

---

## 7. Non-Standard / Creative Visualizations

These go beyond typical BI dashboards but can add a "wow" factor for director presentations.

### 6.1 Racing Bar Chart (Animated Timeline)

An animated horizontal bar chart where countries "race" across months. Each frame = one month, bars grow/shrink and re-rank in real time.

**ECharts support:** Achievable with `timeline` component + animated bar transitions. ECharts has first-class animation support.

**Why it's impressive:** Turns static data into a narrative. Directors can literally watch markets compete over time. Popularized by YouTube data visualization channels — now a recognized BI format.

**Implementation:** Medium complexity. Use ECharts `timeline` option with `animationDurationUpdate` for smooth transitions.

### 6.2 Radar / Spider Chart — Country Performance Profile

A radar chart with axes for: Revenue, Growth %, Share of Total, Month-over-Month Consistency (low variance = good). Each country is a polygon overlay.

**ECharts support:** Native `RadarChart`.

**Why it's interesting:** Shows multi-dimensional performance at once. A country might have high revenue but declining growth — the radar shape reveals this immediately. Useful for identifying "healthy" vs "at risk" markets.

**Implementation:** Low complexity. Register `RadarChart`, create `RadarChart.vue`.

### 6.3 Sankey Diagram — Revenue Flow Decomposition

Show revenue flowing from "Total Revenue" → regions → countries → months, with flow width proportional to amount.

**ECharts support:** Native `SankeyChart`.

**Why it's creative:** Transforms a flat table into an intuitive flow. Directors can trace where money comes from at every level. Visually striking in presentations.

**Implementation:** Medium complexity. Requires data transformation to node/link format.

### 6.4 Calendar Heatmap — Daily Revenue (if granular data available)

If daily data exists, show a GitHub-style calendar heatmap with each day colored by revenue.

**ECharts support:** Native with `CalendarComponent`.

**Why:** Reveals day-of-week and seasonal patterns invisible in monthly aggregation.

### 6.5 Parallel Coordinates — Multi-Country Comparison

Each vertical axis represents a metric (Jan rev, Feb rev, ..., total, growth %). Each country is a line crossing all axes. Clusters and outliers become immediately visible.

**ECharts support:** Native `ParallelChart` + `ParallelComponent`.

**Why it's different:** Rarely seen in standard BI but excellent for comparing entities across many dimensions simultaneously. Especially powerful when filtering interactively.

---

## 8. Global Design Recommendations

### Consistent Color Mapping
Assign each country a fixed color used across ALL charts:

| Country | Color | Rationale |
|---------|-------|-----------|
| Deutschland | `#1f2937` | Dark anchor (home market) |
| UK | `#2563eb` | Blue |
| Iberia | `#ea580c` | Orange |
| Italy | `#16a34a` | Green |
| USA | `#dc2626` | Red |
| France | `#7c3aed` | Purple |
| Mexico | `#0d9488` | Teal |
| NL | `#f59e0b` | Amber |
| Japan | `#ec4899` | Pink |
| Australia | `#6366f1` | Indigo |
| Saudi Arabia | `#84cc16` | Lime |

### Typography & Formatting
- Revenue values: thousands separator (already implemented), currency prefix (€/$/¥ as appropriate)
- Percentages: 1 decimal place, always with +/- sign
- Month labels: short names (Jan, Feb, ...) not numbers

### Interactivity
- All charts should support ECharts `toolbox` for PNG export (directors love screenshots for emails)
- Connected tooltip: hovering a month in one chart highlights the same month in all charts (ECharts `connect` feature)
- Legend click to toggle countries on/off
