# Column Formatting Workflow Options

## Status: Proposal

## Context

Large dashboard table queries can produce many display columns from repeated metric families. A common revenue table shape is:

| Column family | Display suffix |
|---------------|----------------|
| `Vorjahr` | `€` |
| `2026` | `€` |
| `Abw.` | `€` |
| `Abw.%` | `%` |

For a country-by-month revenue table, this creates four formatted columns per country or authorized partner. With 11 countries and a growing number of partners, each new saved query version requires a lot of manual column formatting work in the UI.

The current workaround is to create a fresh query whenever the live dashboard query needs to change. That is reasonable because shared dashboards may be in use, and changing a live query can break the visible table, column order, or formatting. The problem is that fresh queries lose the manual column suffix setup.

The goal is to reduce repeated formatting work without introducing customer-specific behavior such as hardcoded country names, hardcoded partner names, or special handling for this one revenue query.

## Goals

- Keep saved queries and dashboard modules safe to version independently.
- Avoid hardcoded logic for specific countries, partners, years, or table names.
- Support growing result sets where columns follow repeated naming patterns.
- Make formatting reusable across new query versions.
- Keep the feature understandable for an open source BI/dashboard tool.

## Non-Goals

- Do not build a revenue-specific formatter.
- Do not infer business meaning from names like `Deutschland`, `WOL`, or `Amazon`.
- Do not require users to rewrite working SQL just to get display suffixes.
- Do not mutate existing live dashboard modules automatically.

---

## Option A: Column Format Rules

### Concept

Add reusable format rules to a table visualization. Instead of configuring every column one by one, users define rules that match column names.

Example rules:

| Match | Format | Suffix |
|-------|--------|--------|
| `* Vorjahr` | number | `€` |
| `* 2026` | number | `€` |
| `* Abw.` | number | `€` |
| `* Abw.%` | number | `%` |

When query results load, the table applies the first matching rule to each column unless that column has an explicit override.

### Matching Modes

Support a small set of generic matchers:

| Mode | Example | Notes |
|------|---------|-------|
| Exact | `Deutschland 2026` | Current column-level behavior, highest priority |
| Ends with | `Abw.%` | Best for repeated metric suffixes |
| Starts with | `UK ` | Useful for country/source groups |
| Contains | `Revenue` | Simple broad matching |
| Glob | `* Vorjahr` | Friendly for non-technical users |
| Regex | `.*\\s(2025|2026)$` | Advanced mode only |

### Configuration Shape

```json
{
  "columnFormatRules": [
    {
      "matchMode": "endsWith",
      "pattern": "Vorjahr",
      "valueFormat": "number",
      "suffix": "€",
      "fractionDigits": 2
    },
    {
      "matchMode": "endsWith",
      "pattern": "2026",
      "valueFormat": "number",
      "suffix": "€",
      "fractionDigits": 2
    },
    {
      "matchMode": "endsWith",
      "pattern": "Abw.",
      "valueFormat": "number",
      "suffix": "€",
      "fractionDigits": 2
    },
    {
      "matchMode": "endsWith",
      "pattern": "Abw.%",
      "valueFormat": "number",
      "suffix": "%",
      "fractionDigits": 2
    }
  ]
}
```

### UI Behavior

- Keep the existing per-column formatting UI.
- Add a "Format rules" section above or below the column list.
- Show matched columns as a preview count, for example `Matches 13 columns`.
- Allow explicit per-column settings to override rules.
- When a new query version adds `UK ArnoldClark-Abw.%`, the `%` rule applies automatically if the naming convention still matches.

### Pros

- Generic and reusable across any table, not just revenue dashboards.
- Handles new countries, partners, and years if column names follow a convention.
- Preserves exact column overrides for exceptions.
- Does not require SQL changes.
- Fits the current visualization-config model.

### Cons

- Requires new UI and rule evaluation logic.
- Users need to understand rule priority.
- Bad patterns can format unintended columns unless the preview is clear.

### Effort

Medium.

### Recommendation

This is the strongest core product feature. It solves the repeated suffix problem directly while staying modular and open-source friendly.

---

## Option B: Reusable Format Presets

### Concept

Let users save a named set of column format rules and reuse it across dashboard modules.

Example preset:

`Revenue YoY Table`

| Match | Suffix |
|-------|--------|
| `* Vorjahr` | `€` |
| `* 2026` | `€` |
| `* Abw.` | `€` |
| `* Abw.%` | `%` |

When creating a new query and dashboard module, the user selects the preset instead of rebuilding rules manually.

### Storage Options

| Scope | Behavior |
|-------|----------|
| Per module copy | Preset values are copied into the module config at selection time |
| Shared preset reference | Modules reference a central preset by id |

Prefer per module copy first. It keeps shared dashboards stable because later preset edits do not silently change live dashboard modules.

### Pros

- Very useful for the current "create a fresh query" workflow.
- Keeps formatting consistent across versions.
- Makes repeated dashboard maintenance faster.
- Can build on Option A instead of being a separate system.

### Cons

- Needs preset management UI.
- Without Option A, presets still need exact columns and would not solve growing partner columns well.
- Shared preset references can create surprising live changes if not designed carefully.

### Effort

Medium if built after Option A. Higher if built first.

### Recommendation

Build this after column format rules. Presets are the reuse layer; rules are the matching layer that makes reuse valuable.

---

## Option C: Duplicate Module With New Query

### Concept

Add an action to duplicate an existing dashboard module and swap only the saved query.

Workflow:

1. Create a new saved query version.
2. Open the live dashboard module.
3. Click "Duplicate".
4. Select the new query.
5. Keep compatible visualization config, including column formatting, tab settings, sorting, and sizing.
6. Preview the duplicate.
7. Replace or publish when ready.

The copied config can still use exact per-column settings, but it becomes more powerful when combined with Option A because new columns are formatted by rules.

### Pros

- Matches the current safety workflow: do not edit live modules in place.
- Useful beyond this revenue table.
- Low conceptual complexity for users.
- Reduces repeated setup even before presets exist.

### Cons

- Exact copied column settings do not automatically cover newly added columns.
- Needs careful handling for missing/renamed columns.
- Does not solve formatting at the source; it improves the release workflow.

### Effort

Low to medium.

### Recommendation

This is a practical near-term improvement. It should not replace format rules, but it makes query versioning safer and faster.

---

## Option D: SQL-Embedded Display Metadata

### Concept

Allow users to declare display metadata inside the SQL as a structured comment.

Example:

```sql
/* openbase:
{
  "columnFormatRules": [
    { "matchMode": "endsWith", "pattern": "Vorjahr", "suffix": "€" },
    { "matchMode": "endsWith", "pattern": "2026", "suffix": "€" },
    { "matchMode": "endsWith", "pattern": "Abw.", "suffix": "€" },
    { "matchMode": "endsWith", "pattern": "Abw.%", "suffix": "%" }
  ]
}
*/

SELECT ...
```

The saved query parser extracts the metadata and offers to apply it to table visualizations.

### Pros

- Formatting travels with copied SQL.
- Good for users who version queries externally.
- Avoids rebuilding UI config after creating a fresh query.

### Cons

- SQL comments become an application-specific configuration surface.
- Harder to validate and edit than normal UI config.
- May surprise users who expect SQL to be only SQL.
- Some data sources, formatters, or SQL editors may strip comments.

### Effort

Medium.

### Recommendation

Useful for advanced users, but not the best default. Consider only after Option A exists, and treat it as an import/export convenience rather than the primary configuration model.

---

## Option E: Semantic Pivot/Table Builder

### Concept

Instead of manually writing every output column, users describe dimensions and measures:

| Field | Example |
|-------|---------|
| Row dimension | `month` |
| Group dimension | `country` or `partner` |
| Current period | `2026` |
| Previous period | `2025` |
| Measure | `revenue` |
| Derived measures | absolute difference, percentage difference |

Openbase then builds a table with consistent metric columns and known display formats.

### Pros

- Best long-term UX for repeated wide analytical tables.
- Can generate consistent columns, labels, and formats.
- Reduces complex SQL for non-technical users.
- Could support many use cases beyond revenue once generalized.

### Cons

- Large product surface area.
- Hard to support every SQL shape and database dialect.
- Requires a strong data-model abstraction.
- Not necessary to solve the immediate suffix problem.

### Effort

High.

### Recommendation

Keep as a long-term direction. Do not start here for this problem.

---

## Suggested Path

1. Build **Option A: Column Format Rules** for table visualizations.
2. Add **Option C: Duplicate Module With New Query** to support safe query versioning.
3. Add **Option B: Reusable Format Presets** once rules are stable.
4. Consider **Option D: SQL-Embedded Display Metadata** as an advanced import/export feature.
5. Revisit **Option E: Semantic Pivot/Table Builder** only if many dashboards need the same derived analytical layout.

## Recommended First Version

The first implementation should be intentionally small:

- Add table `columnFormatRules` to visualization config.
- Support `exact`, `startsWith`, `endsWith`, and `contains`.
- Apply rules before rendering cell values.
- Keep existing explicit column config as the highest-priority override.
- Show a simple rule editor with match mode, pattern, prefix, suffix, and decimals.
- Do not add shared presets in the first pass.

For the revenue table, the user would configure four rules once:

| Match mode | Pattern | Suffix |
|------------|---------|--------|
| Ends with | `Vorjahr` | `€` |
| Ends with | `2026` | `€` |
| Ends with | `Abw.` | `€` |
| Ends with | `Abw.%` | `%` |

That keeps the implementation generic, avoids hardcoding business-specific behavior, and removes most of the manual work when a fresh query is created.
