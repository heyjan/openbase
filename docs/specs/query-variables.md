# Spec: Query Variables

## Problem

Our queries need to be parameterized so that dashboard viewers can filter data dynamically — e.g. selecting a product from a dropdown to see its price trend over time. Today, `saved_queries.parameters` exists as a JSONB column but is always passed as `{}`. There is no way to:

1. Declare variables inside a query (like Metabase's `{{product}}` syntax)
2. Define how each variable is presented to the user (dropdown from another query, free text, etc.)
3. Populate a variable's options from a second query (e.g. a "product list" query that returns cleaned-up names)
4. Show variable controls on the dashboard so viewers can interact with them

### Reference: Metabase pattern we want to replicate

**Query 1 — Price trend (uses a variable):**
```sql
SELECT DATE(p.scraped_at) AS "Datum",
       ...median subquery...
       ROUND(AVG(p.gesamtpreis), 2) AS "Ø Preis"
FROM price_records p
INNER JOIN (
  SELECT DISTINCT product_url
  FROM price_records
  WHERE product_name LIKE '%' || {{product}} || '%'
  LIMIT 1
) prod ON p.product_url = prod.product_url
WHERE p.rank <= 10
GROUP BY DATE(p.scraped_at)
ORDER BY DATE(p.scraped_at) ASC
```

**Query 2 — Product list (provides dropdown options):**
```sql
SELECT DISTINCT
  TRIM(REPLACE(REPLACE(...product_name...), 'LIQUI MOLY ', '')) AS "Produkt",
  product_name
FROM price_records
ORDER BY product_name
```

In Metabase, `{{product}}` is detected in the SQL, a variable widget appears, and it can be configured to pull its options from the second query's "Produkt" column. We need the same capability.

---

## Design

### 1. Variable declaration syntax

Queries use `{{variable_name}}` to mark where a variable should be substituted. This matches Metabase syntax and is visually distinct from SQL.

When the query editor detects `{{…}}` tokens, it extracts variable names and shows a configuration panel for each one.

At execution time, `{{variable_name}}` is replaced with the named parameter `:variable_name` (SQLite `$variable_name`) before the query is sent to the database adapter. The actual value comes from the parameters map.

### 2. Variable definition schema

Each saved query stores its variable definitions in the existing `parameters` JSONB column, repurposed from a flat key-value map to a structured format:

```ts
type VariableType = 'text' | 'number' | 'select' | 'query_list'

type VariableDefinition = {
  name: string                    // matches {{name}} in query text
  label?: string                  // display label (default: titleCase of name)
  type: VariableType
  required: boolean               // must a value be provided?
  defaultValue?: string | number  // pre-filled value

  // For type: 'select' — static option list
  options?: Array<{ label: string; value: string }>

  // For type: 'query_list' — options loaded from another saved query
  sourceQueryId?: string          // ID of the saved query that provides options
  valueColumn?: string            // column to use as the substituted value
  labelColumn?: string            // column to use as display text (optional, falls back to valueColumn)
}

// The parameters JSONB column becomes:
type QueryParameters = {
  variables: VariableDefinition[]
}
```

### 3. Database changes

No schema migration needed. The `saved_queries.parameters` column is already `JSONB`. We change the shape of the stored JSON from `{}` to `{ variables: [...] }`. Empty/null parameters are treated as "no variables" for backward compatibility.

### 4. Query execution changes

**`server/utils/query-runner.ts`** — new pre-processing step:

1. Parse variable definitions from the saved query's `parameters.variables`
2. For each `{{var}}` in the query text, look up the runtime value from the supplied parameters map
3. Replace `{{var}}` with a named parameter placeholder (`:var` for Postgres, `$var` for SQLite)
4. Pass the values through the existing parameter binding mechanism

This keeps SQL injection protection intact — variables are never string-interpolated into the query, they go through parameterized binding.

```
// Pseudocode
function prepareQuery(queryText, variableDefs, runtimeParams) {
  let prepared = queryText
  const bindParams = {}

  for (const v of variableDefs) {
    const value = runtimeParams[v.name] ?? v.defaultValue
    if (v.required && value == null) throw 'Missing required variable'
    prepared = prepared.replaceAll(`{{${v.name}}}`, `:${v.name}`)
    bindParams[v.name] = value
  }

  return { prepared, bindParams }
}
```

### 5. Query editor UI changes

**`app/components/admin/QueryEditor.vue`** — detect variables and show config:

```
┌─────────────────────────────────────────────────────┐
│ Name: [Price Trend          ]  Data source: [Idealo]│
│ Description: [Median price over time per product   ]│
│                                                     │
│ Query text:                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ SELECT DATE(p.scraped_at) AS "Datum",           │ │
│ │   ...                                           │ │
│ │   WHERE product_name LIKE '%' || {{product}} ...│ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Variables detected:                                 │
│ ┌─────────────────────────────────────────────────┐ │
│ │ product                                         │ │
│ │ Label: [Product           ]                     │ │
│ │ Type:  [query_list ▾]                           │ │
│ │ Source query: [Produktliste ▾]                   │ │
│ │ Value column: [product_name ▾]                  │ │
│ │ Label column: [Produkt ▾]                       │ │
│ │ Required: [✓]  Default: [____________]          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Save query] [Run preview]  product: [Top Tec ▾]   │
└─────────────────────────────────────────────────────┘
```

Key behaviors:
- Variable names are extracted by regex: `/\{\{(\w+)\}\}/g`
- When variables are detected, a "Variables" panel appears below the query text
- Each variable gets a config card with type, label, required, default, and (for `query_list`) source query / column pickers
- The "Run preview" area shows input controls for each variable so the admin can test with real values
- Source query dropdown lists all saved queries; selecting one runs it to populate the column pickers

### 6. Dashboard variable controls

When a dashboard module is linked to a query that has variables, the dashboard needs to show controls for those variables.

#### 6a. Variable controls on the dashboard

**New component: `app/components/dashboard/VariableBar.vue`**

A horizontal bar rendered above the dashboard grid that shows one control per variable across all modules on the dashboard. Variables with the same name across modules are unified into a single control.

```
┌──────────────────────────────────────────────────────┐
│ Product: [Longlife III 5W-30 ▾]     [Apply]          │
├──────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │ Line Chart   │ │ KPI Card     │ │ Data Table   │  │
│ │ (price trend)│ │ (avg price)  │ │ (raw data)   │  │
│ └──────────────┘ └──────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────┘
```

Control types by variable type:
- `text` → text input
- `number` → number input
- `select` → dropdown with static options
- `query_list` → dropdown populated by running the source query

#### 6b. Data flow

1. Dashboard loads → collects variable definitions from all modules' linked queries
2. `VariableBar` renders controls, initialized with default values
3. User selects a value → variable state updates
4. `useModuleData` passes current variable values as `parameters` to the data endpoint
5. Server substitutes `{{var}}` → named param → executes → returns filtered data
6. All modules sharing the same variable name update simultaneously

#### 6c. URL state

Variable values are synced to URL query parameters (`?product=Longlife+III+5W-30`) so that:
- Links to a dashboard preserve the selected filter
- Browser back/forward works
- Public share links can include pre-selected values

### 7. API changes

**New endpoint: `GET /api/admin/queries/:id/variables/options`**

Returns the options for all `query_list` variables in a query. For each variable with a `sourceQueryId`, it runs the source query and returns rows.

```json
// GET /api/admin/queries/:id/variables/options
{
  "product": {
    "options": [
      { "value": "Cera Tec 300 ml", "label": "Cera Tec 300 ml" },
      { "value": "Leichtlauf 10W-40", "label": "Leichtlauf 10W-40" },
      ...
    ]
  }
}
```

**Modified endpoint: `POST /api/admin/queries/:id/preview`**

Already accepts `parameters` in the body — no change needed. The admin preview UI will pass variable values here.

**Modified endpoint: `GET /api/.../modules/:moduleId/data`**

Already accepts query params as filters — no change needed. The `VariableBar` will pass values as query params and `useModuleData` already forwards `route.query` to the endpoint.

### 8. Public dashboard support

For public dashboards (`/d/:slug`), variable options need to be loadable without admin auth:

**New endpoint: `GET /api/dashboards/:slug/variables/options?token=...`**

Collects all variable definitions from all modules on the dashboard, runs their source queries, and returns the merged options. Rate-limited to prevent abuse.

---

## Implementation plan

### Phase 1: Variable detection and storage
- [ ] Add `VariableDefinition` type to `app/types/query.ts`
- [ ] Add `extractVariables(queryText)` utility that parses `{{var}}` tokens
- [ ] Update `query-runner.ts` to pre-process `{{var}}` → named params before execution
- [ ] Update `query-validators.ts` to accept the new `parameters.variables` shape
- [ ] Write tests for variable extraction and query preparation

### Phase 2: Query editor variable configuration
- [ ] Add variable detection to `QueryEditor.vue` (reactive regex parse of query text)
- [ ] Add variable config panel (type, label, required, default, source query, columns)
- [ ] Add preview-time variable input controls
- [ ] Add `GET /api/admin/queries/:id/variables/options` endpoint
- [ ] Save variable definitions into `saved_queries.parameters`

### Phase 3: Dashboard variable bar
- [ ] Create `VariableBar.vue` component
- [ ] Aggregate variables across all modules on a dashboard
- [ ] Wire variable values into `useModuleData` as parameters
- [ ] Sync variable state to URL query params
- [ ] Add `GET /api/dashboards/:slug/variables/options` for public dashboards

### Phase 4: Polish
- [ ] Handle edge cases: missing source query (deleted), empty option lists, variable renamed in SQL
- [ ] Add loading states for option fetching
- [ ] Cache source query results (options don't change often)
- [ ] Variable bar responsive layout for mobile

---

## Non-goals

- **Multi-value variables** (e.g. select multiple products) — can be added later
- **Date range variables** — useful but separate scope
- **Variable dependencies** (variable B's options depend on variable A's value) — too complex for v1
- **Cross-dashboard variable linking** — each dashboard manages its own variable state
