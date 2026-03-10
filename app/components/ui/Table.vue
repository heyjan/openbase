<script setup lang="ts">
import { h, resolveComponent, type CSSProperties } from 'vue'

type TableRow = Record<string, unknown>

type ColumnInput = {
  key: string
  label?: string
}

type EditingCell = {
  rowIndex: number
  columnKey: string
}

const normalizeColumn = (value: string) => value.trim().toLowerCase()

const toDisplayValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const props = withDefaults(
  defineProps<{
    rows: TableRow[]
    columns?: ColumnInput[]
    emptyLabel?: string
    cellStyleResolver?: (input: {
      row: TableRow
      columnKey: string
      value: unknown
      rowIndex: number
    }) => CSSProperties | undefined
    columnStyleResolver?: (input: {
      columnKey: string
    }) => CSSProperties | undefined
    cellValueFormatter?: (input: {
      row: TableRow
      columnKey: string
      value: unknown
      rowIndex: number
      defaultValue: string
    }) => string
    editingCell?: EditingCell | null
    editValue?: string
    editableColumns?: string[]
    saving?: boolean
    onStartEdit?: (rowIndex: number, columnKey: string) => void
    onEditValueChange?: (value: string) => void
    onSaveEdit?: () => void | Promise<void>
    onCancelEdit?: () => void
  }>(),
  {
    columns: () => [],
    emptyLabel: 'No rows found.',
    cellStyleResolver: undefined,
    columnStyleResolver: undefined,
    cellValueFormatter: undefined,
    editingCell: null,
    editValue: '',
    editableColumns: () => [],
    saving: false,
    onStartEdit: undefined,
    onEditValueChange: undefined,
    onSaveEdit: undefined,
    onCancelEdit: undefined
  }
)

const UButton = resolveComponent('UButton')
const editableColumnsSet = computed(() =>
  new Set(props.editableColumns.map(normalizeColumn))
)

const derivedColumns = computed<ColumnInput[]>(() => {
  if (props.columns.length) {
    return props.columns
  }

  const first = props.rows[0]
  if (!first) {
    return []
  }

  return Object.keys(first).map((key) => ({
    key,
    label: key
  }))
})

const tableColumns = computed(() =>
  derivedColumns.value.map((column) => ({
    id: column.key,
    accessorFn: (row: TableRow) => row[column.key],
    enableSorting: true,
    header: ({ column: tableColumn }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void } }) => {
      const sort = tableColumn.getIsSorted()
      const indicator = sort === 'asc' ? ' ↑' : sort === 'desc' ? ' ↓' : ''
      const style = props.columnStyleResolver?.({ columnKey: column.key })

      return h(
        'div',
        {
          class: 'inline-flex w-full items-center rounded-sm',
          style
        },
        [
          h(
            UButton,
            {
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              class: '-ml-2 font-semibold text-gray-700',
              onClick: () => tableColumn.toggleSorting(sort === 'asc')
            },
            () => `${column.label ?? column.key}${indicator}`
          )
        ]
      )
    },
    cell: ({
      getValue,
      row,
      column
    }: {
      getValue: () => unknown
      row: { original: TableRow; index: number }
      column: { id: string }
    }) => {
      const value = getValue()
      const style = props.cellStyleResolver?.({
        row: row.original,
        rowIndex: row.index,
        columnKey: column.id,
        value
      })

      const defaultValue = toDisplayValue(value)
      const rendered = props.cellValueFormatter?.({
        row: row.original,
        rowIndex: row.index,
        columnKey: column.id,
        value,
        defaultValue
      }) ?? defaultValue
      const isEditable =
        editableColumnsSet.value.has(normalizeColumn(column.id)) &&
        typeof props.onStartEdit === 'function'
      const isEditing =
        props.editingCell?.rowIndex === row.index &&
        props.editingCell?.columnKey === column.id

      if (isEditable && isEditing) {
        const onFocusOut = (event: FocusEvent) => {
          const currentTarget = event.currentTarget as HTMLElement | null
          const relatedTarget = event.relatedTarget as Node | null
          if (!currentTarget) {
            return
          }
          if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return
          }
          props.onCancelEdit?.()
        }

        return h(
          'div',
          {
            class: 'inline-flex w-full items-center gap-1 rounded border border-blue-200 bg-white p-1',
            onFocusout: onFocusOut
          },
          [
            h('input', {
              value: props.editValue ?? '',
              disabled: props.saving,
              class:
                'min-w-0 flex-1 rounded border border-blue-300 px-2 py-1 text-sm text-gray-900 outline-none ring-0 focus:border-blue-500',
              onInput: (event: Event) => {
                const target = event.target as HTMLInputElement
                props.onEditValueChange?.(target.value)
              },
              onKeydown: (event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  props.onSaveEdit?.()
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  props.onCancelEdit?.()
                }
              },
              onVnodeMounted: (vnode: { el: Element | null }) => {
                const input = vnode.el as HTMLInputElement | null
                if (!input) {
                  return
                }
                input.focus()
                input.select()
              }
            }),
            h(
              'button',
              {
                type: 'button',
                disabled: props.saving,
                class:
                  'inline-flex h-7 w-7 items-center justify-center rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60',
                onClick: (event: MouseEvent) => {
                  event.preventDefault()
                  props.onSaveEdit?.()
                }
              },
              props.saving
                ? h('span', {
                    class:
                      'h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-600 border-t-transparent'
                  })
                : '✓'
            ),
            h(
              'button',
              {
                type: 'button',
                disabled: props.saving,
                class:
                  'inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
                onClick: (event: MouseEvent) => {
                  event.preventDefault()
                  props.onCancelEdit?.()
                }
              },
              '×'
            )
          ]
        )
      }

      if (isEditable) {
        const isEmpty = rendered.length === 0
        return h(
          'span',
          {
            role: 'button',
            tabindex: 0,
            class: [
              style
                ? 'ob-cell-fill block w-full px-4 py-4'
                : 'inline-block w-full rounded px-1 py-0.5',
              'cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200',
              isEmpty ? 'text-gray-400' : ''
            ],
            style,
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              props.onStartEdit?.(row.index, column.id)
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                props.onStartEdit?.(row.index, column.id)
              }
            }
          },
          isEmpty ? '(click to edit)' : rendered
        )
      }

      if (!style) {
        return rendered
      }

      return h(
        'span',
        {
          class: 'ob-cell-fill block w-full px-4 py-4',
          style
        },
        rendered
      )
    }
  }))
)
</script>

<template>
  <p v-if="!rows.length" class="px-3 py-4 text-sm text-gray-500">{{ emptyLabel }}</p>
  <div
    v-else
    class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm"
  >
    <UTable
      :data="rows"
      :columns="tableColumns"
      class="ob-table w-full [&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-gray-700 [&_tbody_td]:align-top [&_tbody_td]:py-2.5 [&_tbody_td]:text-sm [&_tbody_td]:text-gray-700"
    />
  </div>
</template>

<style scoped>
.ob-table :deep(table) {
  min-width: 100%;
  width: max-content;
  table-layout: auto;
}

.ob-table :deep(thead th) {
  background-color: #f6ebe8;
  background-color: color-mix(in srgb, var(--color-brand-secondary, #d97556) 16%, white);
  border-bottom: 1px solid #d1d5db;
  white-space: nowrap;
}

.ob-table :deep(tbody td) {
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.ob-table :deep(tbody td:has(.ob-cell-fill)) {
  padding: 0;
}

.ob-table :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

.ob-table :deep(tbody tr:hover) {
  background-color: #f9fafb;
}
</style>
