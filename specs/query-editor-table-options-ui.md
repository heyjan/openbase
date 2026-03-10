# Spec: Query Editor Table Options — UI Consolidation

## Goal
Simplify the table options panel by merging the two-column layout (visible columns + column order) into a single unified column list, adding per-column color and gradient controls, improving the top-level controls with icons, consolidating value affixes into column cards, and moving the options panel into the sidebar for live preview.

---

## 1. Top Controls Bar (search, sort, row limit)

**Current:** 4-column grid mixed with the column sections below. Search bar is a toggle switch with no icon. Sort/limit labels are plain text.

**New:** Move to the top of the table options section (directly after "Title override"). Display as a horizontal bar with icons for quick recognition.

| Control | Icon (lucide) | Notes |
|---|---|---|
| Search bar toggle | `Search` | Keep as `USwitch`, prepend icon |
| Sort column | `ArrowUpDown` | `USelect` dropdown, prepend icon |
| Sort direction | `ArrowUpAZ` / `ArrowDownAZ` | `USelect`, prepend icon |
| Row limit | `Hash` | `UInput type="number"`, prepend icon |

Layout: `grid md:grid-cols-4` with each cell being a compact card (`rounded border border-gray-200 bg-gray-50 px-3 py-2`), icon + label inline.

---

## 2. Unified Column List (replaces both "Visible columns" and "Column order")

**Current:** Two side-by-side panels — left is checkbox list for visibility, right is draggable list for ordering.

**New:** Single draggable list. Each card contains:

```
┌─────────────────────────────────────────────────────┐
│ ⠿ column_name          👁  🎨 [▣]   ↑  ↓          │
│   grip     name        eye color gradient  move     │
│   [prefix ___] [suffix ___]                         │
└─────────────────────────────────────────────────────┘
```

Per-card controls (left to right, top row):
- **Grip handle** (`GripVertical`) — existing drag-to-reorder
- **Column name** — text label
- **Visibility toggle** (`Eye` / `EyeOff` from lucide) — replaces the checkbox list. Click toggles `visibleColumns`. When hidden, the card row gets `opacity-50` styling
- **Color picker** — small color swatch button. Clicking opens a native `<input type="color">`. Stores per-column color in a new `columnColors` config key
- **Gradient toggle** — small button (`Blend` or `Paintbrush` icon). Only shown for numeric columns. When active, applies a value-based gradient using the column's color. Stores in a new `columnGradients` config key
- **Move up/down** — existing `↑` `↓` buttons

Per-card controls (bottom row — inline affixes):
- **Prefix** — small `UInput` (`placeholder="Prefix"`) for `columnValueFormats[column].prefix`
- **Suffix** — small `UInput` (`placeholder="Suffix"`) for `columnValueFormats[column].suffix`
- Layout: `grid grid-cols-2 gap-2` below the top row, only visible when the card is expanded or always shown compactly

**Remove:** The entire "Visible columns" checkbox section and its grid column.
**Remove:** The separate "Value affixes" section (§679–708 in current `VizOptionsPanel.vue`). Prefix/suffix inputs are now part of each column card above.

---

## 3. Data Model Changes (`viz-options.ts`)

Add to `TableVizOptions`:

```ts
export type TableVizOptions = SharedVizOptions & {
  // existing...
  columnColors?: Record<string, string>       // e.g. { "price": "#2563eb" }
  columnGradients?: Record<string, boolean>   // e.g. { "ranking": true }
}
```

- `columnColors` — hex color per column. When set, body cells get a light transparent background tint (`${color}20`). Headers are **not** styled.
- `columnGradients` — when `true` for a column, cells are shaded on a gradient from light→saturated based on the cell's value relative to the column's min/max range. The gradient base color comes from `columnColors[column]` (default `#2563eb` if unset).

---

## 4. Gradient Rendering Logic (`useVizConfig.ts`)

Add a new resolver function:

```ts
getColumnGradientStyle(
  column: string,
  value: unknown,
  extents: { min: number; max: number },
  baseColor: string
): CSSProperties | null
```

- Normalizes `value` to a 0–1 ratio within `[min, max]`
- Returns `{ backgroundColor: <color with opacity> }` where opacity maps from ~0.1 (min) to ~0.9 (max)
- Uses the column's configured color or falls back to blue
- Returns `null` for non-numeric values

Integrate into `cellStyleResolver` in both `DataTable.vue` and `QueryPreviewResult.vue` — gradient styles apply **before** conditional formatting rules (conditional rules win if both match).

---

## 5. Column Color Rendering — REVISED

> **Bug fix:** The original spec used `borderLeft: 3px solid ${color}` which had two problems:
> 1. The border-left color leaked into `<thead>` header cells via `columnStyleResolver` — headers should have **no** color styling.
> 2. The intended visual was a **background color**, not a left border.

When `columnColors[column]` is set (without gradient):
- **Header cells (`<thead>`):** No color styling at all. `columnStyleResolver` must return `undefined` for all columns (remove the border-left logic).
- **Body cells (`<td>`):** Apply a light transparent background: `{ backgroundColor: '${color}20' }` (hex + `20` ≈ 12% opacity). This gives a subtle tinted background that preserves text readability.

Implementation changes needed:
- `DataTable.vue` `columnStyleResolver`: always return `undefined` (no header styling)
- `DataTable.vue` `cellStyleResolver`: replace `{ borderLeft: \`3px solid ${columnColor}\` }` with `{ backgroundColor: \`${columnColor}20\` }`
- `QueryPreviewResult.vue` `tableColumnStyleResolver`: same — always return `undefined`
- `QueryPreviewResult.vue` `tableCellStyleResolver`: same — replace border-left with background color

The color is decorative/organizational. When gradient is enabled for the column, the gradient style takes precedence (no double background).

---

## 6. Script Logic Changes (`VizOptionsPanel.vue`)

Existing function `updateColumnValueFormat()` (already implemented) is reused for the inline prefix/suffix inputs in each column card — no new logic needed for affixes, just a template move.

New functions needed:

```ts
const columnColors = computed(() => /* read columnColors from modelValue */)
const columnGradients = computed(() => /* read columnGradients from modelValue */)

const updateColumnColor = (column: string, color: string) => {
  updateConfig({ columnColors: { ...columnColors.value, [column]: color } })
}

const clearColumnColor = (column: string) => {
  const next = { ...columnColors.value }
  delete next[column]
  updateConfig({ columnColors: Object.keys(next).length ? next : undefined })
}

const toggleColumnGradient = (column: string) => {
  const next = { ...columnGradients.value }
  if (next[column]) delete next[column]
  else next[column] = true
  updateConfig({ columnGradients: Object.keys(next).length ? next : undefined })
}
```

---

## 7. Shared Link / Public View

Both `columnColors` and `columnGradients` are stored in the same `vizOptions` JSON that already persists to the database and is read by the shared view. No additional plumbing needed — the shared `DataTable.vue` and `QueryPreviewResult.vue` already use `cellStyleResolver`, which we extend.

---

## 8. Move Options Panel to Sidebar (`QueryEditor.vue`)

**Problem:** When editing table options with many columns, the user has to scroll past the options panel to see the table preview — making it impossible to see changes in real time.

**Current layout:**
```
┌──────────────────────────────────────────────────┐
│ ┌─────────┐  ┌──────────────────────────────────┐│
│ │ Viz Grid│  │ VizOptionsPanel                  ││
│ │ (180px) │  │ ...long column list...           ││
│ │         │  │                                  ││
│ │         │  ├──────────────────────────────────┤│
│ │         │  │ QueryPreviewResult (table)       ││
│ └─────────┘  └──────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

**New layout:** Move `VizOptionsPanel` into the sidebar, below the visualization type grid. Widen the sidebar from `180px` to `280px`. The main content area shows only the table preview, so the table is always visible while options are adjusted.

```
┌──────────────────────────────────────────────────┐
│ ┌───────────┐  ┌────────────────────────────────┐│
│ │ Viz Grid  │  │ QueryPreviewResult (table)     ││
│ │           │  │                                ││
│ │ ────────  │  │  always visible while editing  ││
│ │           │  │                                ││
│ │ VizOptions│  │                                ││
│ │ Panel     │  │                                ││
│ │ (scrolls  │  │                                ││
│ │  inside)  │  │                                ││
│ └───────────┘  └────────────────────────────────┘│
│    280px                flex-1                    │
└──────────────────────────────────────────────────┘
```

Changes to `QueryEditor.vue`:
- `<aside>`: change `lg:w-[180px]` → `lg:w-[280px]`
- Grid inside aside: change `sm:w-[180px]` → `w-full`
- Move `<VizOptionsPanel>` from the main content `<div>` into the `<aside>`, positioned after the viz type grid
- The sidebar should get `overflow-y-auto` and a max-height (e.g., `lg:max-h-[calc(100vh-200px)]`) so it scrolls independently
- Remove `class="mb-3"` from VizOptionsPanel (no longer needs bottom margin before the table)

---

## 9. Files to Modify (updated)

| File | Changes |
|---|---|
| `app/types/viz-options.ts` | Add `columnColors`, `columnGradients` to `TableVizOptions` |
| `app/composables/useVizConfig.ts` | Add `resolveColumnColors()`, `resolveColumnGradients()`, `getColumnGradientStyle()`. Update `getConditionalCellStyle()` to layer gradient below conditional rules |
| `app/components/admin/VizOptionsPanel.vue` | Merge columns UI, add top controls bar with icons, add color/gradient controls per column card, **move prefix/suffix inputs into each column card**, **remove the separate "Value affixes" section** |
| `app/components/modules/DataTable.vue` | Integrate gradient + color into `cellStyleResolver`. **Fix:** change column color from `borderLeft` to `backgroundColor` with opacity. **Fix:** `columnStyleResolver` must return `undefined` (no header color) |
| `app/components/admin/QueryPreviewResult.vue` | Same fixes as DataTable — background color on cells, no header styling |
| `app/components/ui/Table.vue` | Add support for per-column header styling via new optional `columnStyleResolver` prop |
| `app/components/admin/QueryEditor.vue` | **New:** Move `VizOptionsPanel` into sidebar, widen sidebar from `180px` → `280px`, add sidebar scrolling |

---

## 10. New Lucide Imports

```ts
import {
  Eye, EyeOff,          // visibility toggle
  Search,               // search bar icon
  ArrowUpDown,          // sort column icon
  ArrowUpAZ, ArrowDownAZ, // sort direction
  Hash,                 // row limit icon
  Palette,              // color picker trigger
  Blend                 // gradient toggle
} from 'lucide-vue-next'
```

---

## Summary of UX Wins

1. **One list instead of two** — less visual clutter, fewer scrolling areas
2. **Inline visibility toggle** — eye icon is more intuitive than a separate checkbox list
3. **Per-column color** — quick visual grouping/identification (background tint, not border)
4. **Gradient shading** — instant data density visualization without conditional formatting rules
5. **Top controls with icons** — faster scanning, cleaner hierarchy
6. **Inline prefix/suffix** — affixes configured per column in the same card, no separate section
7. **Sidebar options panel** — table preview always visible while adjusting options
