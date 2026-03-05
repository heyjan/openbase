<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'
import Table from '~/components/ui/Table.vue'
import { useInlineCellEdit } from '~/composables/useInlineCellEdit'
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
  editable?: boolean
  refresh?: () => Promise<void>
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

const moduleId = computed(() => props.module.id)
const inlineEditEnabled = computed(() => Boolean(props.editable))
const inlineCellEdit = useInlineCellEdit({
  moduleId,
  enabled: inlineEditEnabled,
  refresh: props.refresh
})

const isInlineEditable = computed(
  () => inlineEditEnabled.value && inlineCellEdit.meta.value.editable
)

const editableColumns = computed(() =>
  isInlineEditable.value ? inlineCellEdit.editableColumns.value : []
)

const onStartEdit = (rowIndex: number, columnKey: string) => {
  inlineCellEdit.startEdit(rowIndex, columnKey, filteredRows.value)
}

const onSaveEdit = () => inlineCellEdit.saveCell(filteredRows.value)
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
        :editing-cell="isInlineEditable ? inlineCellEdit.editingCell.value : null"
        :edit-value="inlineCellEdit.editValue.value"
        :editable-columns="editableColumns"
        :saving="inlineCellEdit.saving.value"
        :on-start-edit="isInlineEditable ? onStartEdit : undefined"
        :on-edit-value-change="inlineCellEdit.setEditValue"
        :on-save-edit="isInlineEditable ? onSaveEdit : undefined"
        :on-cancel-edit="inlineCellEdit.cancelEdit"
        empty-label="No matching rows."
      />
    </div>
  </div>
</template>
