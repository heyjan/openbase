# Query Analysis: "Abw." / "Abw. %" Columns Hidden in Wide Preview Tables

## Summary

The SQL query is valid and returns correct difference values. The issue was in table rendering: columns with labels like `Abw.` and `Abw. %` were not reliably visible/readable in large, wide result sets.

## Findings

1. Query output is correct at the database level.
2. The UI table used `accessorKey` for every column key.
3. Column names containing `.` (for example `Abw.`) are unsafe for key-path access and can resolve incorrectly.
4. Very wide result sets (for example 45 columns) were also being compressed, so key columns were effectively hidden in the available viewport.

## Root Cause

The issue was caused by table UI behavior, not SQL:

- Key access: dot-containing column keys were passed via `accessorKey`.
- Layout: wide tables were not explicitly rendered in content-width mode with horizontal scrolling at the table container level.

## Fix Implemented

In `app/components/ui/Table.vue`:

1. Replaced `accessorKey` with explicit `id` + `accessorFn`, so original column keys (including dots) resolve reliably.
2. Changed wrapper overflow to horizontal scrolling (`overflow-x-auto`).
3. Forced content-based table sizing (`width: max-content`, `min-width: 100%`, `table-layout: auto`) so all columns remain reachable.
4. Kept cell/header text on one line (`white-space: nowrap`) to prevent unreadable, collapsed multi-line headers in dense result sets.

## Expected Result

For large query previews:

- `Abw.` and `Abw. %` columns remain visible in the table structure.
- Column values render correctly even with dots in column names.
- Width adapts to content, and horizontal scroll exposes all columns cleanly.
