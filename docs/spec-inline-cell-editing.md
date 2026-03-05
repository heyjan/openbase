# Inline Cell Editing for Dashboard Tables

## Context

Editors previously had a clunky separate write page with generic INSERT/UPDATE forms. The real use case is simple: an editor logs in monthly, sees a dashboard table (e.g., Country | Month | Revenue), and types revenue numbers into 15 cells. We need click-to-edit directly in the dashboard table — no separate page needed.

**Use case:** Editor has 15 countries, enters revenue for each monthly. Only the `revenue` column is editable; `country` and `month` are read-only context.

## Architecture

Dashboard modules and writable tables are currently disconnected. We bridge them by:
1. Admin adds `writableTableId` to a data_table module's config JSON (no schema migration needed — `modules.config` is already JSONB)
2. New backend endpoint returns editable column metadata to the frontend
3. Frontend renders editable cells with click-to-edit inline input + save/cancel buttons

## Implementation Plan

### Step 1: PK Detection Utility
**File:** `server/utils/table-schema.ts` (add function)

Add `getPostgresTablePrimaryKey(connection, tableName)` → `string[]`
- Queries `information_schema.table_constraints` + `key_column_usage` for PRIMARY KEY columns
- Follows existing pattern of `getPostgresTableSchema` in same file
- Used by the writable-meta endpoint to build WHERE clauses

### Step 2: Writable Meta Endpoint
**New file:** `server/api/editor/dashboards/[slug]/modules/[moduleId]/writable-meta.get.ts`

Follow the exact pattern of the existing `data.get.ts` in same directory (auth, dashboard lookup, permission check, module lookup). Then:
1. Read `module.config.writableTableId` — if missing, return `{ editable: false }`
2. Call `canEditorWriteToTable(editorId, writableTableId)` — if not allowed or `allowUpdate` false, return `{ editable: false }`
3. Get writable table config for `editableColumns` (from `allowedColumns`)
4. Get primary key columns via the new utility
5. Return:
```json
{
  "editable": true,
  "writableTableId": "uuid",
  "editableColumns": ["revenue"],
  "identifierColumns": ["id"]
}
```
If no PK found, fall back to all columns minus editable columns as identifiers.

### Step 3: Inline Edit Composable
**New file:** `app/composables/useInlineCellEdit.ts`

State: `editingCell` (rowIndex + columnKey), `editValue`, `saving`, `saveError`

Functions:
- `fetchMeta()` — calls writable-meta endpoint, caches result
- `isColumnEditable(key)` — checks against `meta.editableColumns`
- `startEdit(rowIndex, columnKey)` — sets editing state, populates editValue from current row
- `cancelEdit()` — clears state
- `saveCell(rows)` — builds `values` + `where` from meta.identifierColumns, calls existing `PUT /api/editor/writable-tables/[id]/update`, optimistically updates the row, calls refresh on success

Reuses `useEditorDataEntry().updateRows()` for the actual API call.

### Step 4: Wire Up ModuleRenderer
**File:** `app/components/modules/ModuleRenderer.vue`

- Add `isEditorRoute` computed (check `route.path.startsWith('/editor/dashboards/')`)
- Pass `:editable="isEditorRoute && module.type === 'data_table'"` to the DataTable component

### Step 5: Update DataTable.vue
**File:** `app/components/modules/DataTable.vue`

- Accept `editable?: boolean` and `refresh?: () => Promise<void>` props
- When `editable` is true, initialize `useInlineCellEdit` composable
- Pass inline edit props (editingCell, editValue, editableColumns, callbacks) down to `Table.vue`

### Step 6: Editable Cells in Table.vue
**File:** `app/components/ui/Table.vue`

New optional props:
```typescript
editingCell?: { rowIndex: number; columnKey: string } | null
editValue?: string
editableColumns?: string[]
saving?: boolean
onStartEdit?: (rowIndex: number, columnKey: string) => void
onEditValueChange?: (value: string) => void
onSaveEdit?: () => void
onCancelEdit?: () => void
```

Modify the TanStack `cell` render function (lines 68-106):

**Editable cell (idle):** Normal text with hover effect (`hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 cursor-pointer`). Empty cells show muted "(click to edit)" placeholder.

**Editable cell (editing):** Replace cell content with:
- `<input>` with blue border, auto-focused
- Green checkmark button (save)
- Gray X button (cancel)
- Enter = save, Escape = cancel
- Click outside = cancel

**Editable cell (saving):** Input disabled, checkmark shows loading spinner.

**Non-editable cells:** Completely unchanged.

## Data Flow

```
Admin: sets modules.config.writableTableId = "wt-123" on a data_table module

Editor opens /editor/dashboards/test123:
  → useModuleData fetches table rows (existing flow, unchanged)
  → useInlineCellEdit fetches GET /editor/dashboards/test123/modules/:id/writable-meta
    → Returns { editable: true, writableTableId: "wt-123",
                editableColumns: ["revenue"], identifierColumns: ["country","month"] }
  → DataTable renders: Country and Month as plain text,
    Revenue cells with edit affordance

Editor clicks Revenue cell for Germany/2024-01:
  → Input appears with current value, green check + gray X buttons
  → Types "50000", presses Enter (or clicks green check)
  → PUT /api/editor/writable-tables/wt-123/update
    body: { values: { revenue: "50000" }, where: { country: "Germany", month: "2024-01" } }
  → Cell updates immediately (optimistic), full refresh follows
  → Editor moves to next row
```

## Files to Modify/Create

| Action | File |
|--------|------|
| Edit | `server/utils/table-schema.ts` — add `getPostgresTablePrimaryKey` |
| Create | `server/api/editor/dashboards/[slug]/modules/[moduleId]/writable-meta.get.ts` |
| Create | `app/composables/useInlineCellEdit.ts` |
| Edit | `app/components/modules/ModuleRenderer.vue` — pass `editable` prop |
| Edit | `app/components/modules/DataTable.vue` — wire up composable |
| Edit | `app/components/ui/Table.vue` — editable cell rendering |

## Error Handling

- **Stale data:** After save, refresh full dataset from server
- **Multi-row update warning:** If `rowCount > 1` returned, show warning toast
- **No match:** If `rowCount === 0`, show error and rollback
- **Type coercion:** Backend `write-validators.ts` handles string → correct PG type
- **Empty values:** Send `null` for nullable columns when input is cleared

## Verification

1. Set `writableTableId` in a data_table module's config (via admin JSON editor)
2. Log in as editor at `/editor/login`
3. Navigate to the dashboard with the linked table
4. Revenue cells should show hover effect (light blue background)
5. Click a cell → input appears with save/cancel buttons
6. Type value, press Enter → cell updates, verify in database
7. Press Escape → edit cancelled, no changes
8. Verify non-editable columns (Country, Month) cannot be clicked
9. Verify admin/public dashboard views show NO editing UI
