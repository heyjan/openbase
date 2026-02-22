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
  }>(),
  {
    columns: () => [],
    emptyLabel: 'No rows found.'
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
          class: '-ml-2 font-semibold',
          onClick: () => tableColumn.toggleSorting(sort === 'asc')
        },
        () => `${column.label ?? column.key}${indicator}`
      )
    },
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const value = getValue()
      if (value === null || value === undefined) {
        return ''
      }
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }
      return String(value)
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
      class="min-w-full [&_thead_th]:bg-gray-50 [&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-gray-500 [&_tbody_td]:align-top [&_tbody_td]:py-2.5 [&_tbody_td]:text-sm [&_tbody_td]:text-gray-700 [&_tbody_tr:nth-child(even)]:bg-gray-50/40 [&_tbody_tr:hover]:bg-gray-50"
    />
  </div>
</template>
