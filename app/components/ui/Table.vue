<script setup lang="ts">
import { h, resolveComponent } from 'vue'

type TableRow = Record<string, unknown>

type ColumnInput = {
  key: string
  label?: string
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
    }) => Record<string, string> | undefined
  }>(),
  {
    columns: () => [],
    emptyLabel: 'No rows found.',
    cellStyleResolver: undefined
  }
)

const UButton = resolveComponent('UButton')

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
    accessorKey: column.key,
    enableSorting: true,
    header: ({ column: tableColumn }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void } }) => {
      const sort = tableColumn.getIsSorted()
      const indicator = sort === 'asc' ? ' ↑' : sort === 'desc' ? ' ↓' : ''

      return h(
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

      let rendered = ''
      if (value === null || value === undefined) {
        rendered = ''
      } else if (typeof value === 'object') {
        rendered = JSON.stringify(value)
      } else {
        rendered = String(value)
      }

      if (!style) {
        return rendered
      }

      return h(
        'span',
        {
          class: 'inline-block w-full rounded px-1 py-0.5',
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
    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
  >
    <UTable
      :data="rows"
      :columns="tableColumns"
      class="ob-table min-w-full [&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-gray-700 [&_tbody_td]:align-top [&_tbody_td]:py-2.5 [&_tbody_td]:text-sm [&_tbody_td]:text-gray-700"
    />
  </div>
</template>

<style scoped>
.ob-table :deep(thead th) {
  background-color: #f6ebe8;
  background-color: color-mix(in srgb, var(--color-brand-secondary, #d97556) 16%, white);
  border-bottom: 1px solid #d1d5db;
}

.ob-table :deep(tbody td) {
  border-bottom: 1px solid #e5e7eb;
}

.ob-table :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

.ob-table :deep(tbody tr:hover) {
  background-color: #f9fafb;
}
</style>
