<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'
import Table from '~/components/ui/Table.vue'
import {
  applyTableSortAndLimit,
  getColumnNumericExtents,
  getConditionalCellStyle,
  parseConditionalFormattingRules,
  resolveTableColumnOrder,
  resolveTableVisibleColumns
} from '~/composables/useVizConfig'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const search = ref('')
const showSearch = computed(() => {
  const config = props.module.config ?? {}
  if (typeof config.showSearch === 'boolean') {
    return config.showSearch
  }
  if (typeof config.show_search === 'boolean') {
    return config.show_search
  }
  return false
})

const allRows = computed(() => props.moduleData?.rows ?? [])

const baseColumns = computed(() => {
  const configured = props.moduleData?.columns ?? []
  if (configured.length) {
    return configured
  }
  const first = allRows.value[0]
  return first ? Object.keys(first) : []
})

const orderedColumns = computed(() =>
  resolveTableColumnOrder(baseColumns.value, props.module.config)
)

const visibleColumns = computed(() =>
  resolveTableVisibleColumns(orderedColumns.value, props.module.config)
)

const rows = computed(() => applyTableSortAndLimit(allRows.value, props.module.config))

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const filteredRows = computed(() => {
  if (!showSearch.value) {
    return rows.value
  }

  const query = search.value.trim().toLowerCase()
  if (!query) {
    return rows.value
  }

  return rows.value.filter((row) =>
    visibleColumns.value.some((column) =>
      normalizeValue(row[column]).toLowerCase().includes(query)
    )
  )
})

watch(showSearch, (enabled) => {
  if (!enabled) {
    search.value = ''
  }
})

const tableColumns = computed(() =>
  visibleColumns.value.map((column) => ({
    key: column,
    label: column
  }))
)

const conditionalRules = computed(() =>
  parseConditionalFormattingRules(props.module.config.conditionalFormatting)
)

const columnExtents = computed(() =>
  getColumnNumericExtents(filteredRows.value, visibleColumns.value)
)

const cellStyleResolver = (input: { columnKey: string; value: unknown }) =>
  getConditionalCellStyle({
    columnKey: input.columnKey,
    value: input.value,
    rules: conditionalRules.value,
    columnExtents: columnExtents.value
  })
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="showSearch" class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        placeholder="Search rows"
        class="w-full max-w-xs"
      />
    </div>

    <p v-if="!tableColumns.length" class="mt-4 text-sm text-gray-500">
      No data available.
    </p>

    <div
      v-else
      :class="showSearch ? 'mt-3 min-h-0 flex-1 overflow-auto' : 'min-h-0 flex-1 overflow-auto'"
    >
      <Table
        :rows="filteredRows"
        :columns="tableColumns"
        :cell-style-resolver="cellStyleResolver"
        empty-label="No matching rows."
      />
    </div>
  </div>
</template>
