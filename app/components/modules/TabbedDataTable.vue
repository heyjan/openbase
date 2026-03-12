<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'
import Table from '~/components/ui/Table.vue'
import { useInlineCellEdit } from '~/composables/useInlineCellEdit'
import {
  applyTableSortAndLimit,
  detectTableTabGroups,
  formatTableCellDisplayValue,
  getColumnGradientStyle,
  getColumnNumericExtents,
  getConditionalCellStyle,
  parseConditionalFormattingRules,
  resolveColumnColors,
  resolveColumnGradients,
  resolveTableColumnOrder,
  resolveTableColumnValueFormats,
  resolveTableTabDefault,
  resolveTableTabGroupSeparator,
  resolveTableTabSharedColumns,
  resolveTableVisibleColumns,
  stripTableTabGroupPrefix
} from '~/composables/useVizConfig'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
  editable?: boolean
  refresh?: () => Promise<void>
}>()

const search = ref('')
const activeTab = ref('')

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

const useThousandsSeparator = computed(() => {
  const config = props.module.config ?? {}
  if (typeof config.useThousandsSeparator === 'boolean') {
    return config.useThousandsSeparator
  }
  if (typeof config.use_thousands_separator === 'boolean') {
    return config.use_thousands_separator
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

const tabGroupSeparator = computed(() =>
  resolveTableTabGroupSeparator(props.module.config ?? {})
)

const tabSharedColumns = computed(() =>
  resolveTableTabSharedColumns(visibleColumns.value, props.module.config ?? {})
)

const tabDefault = computed(() =>
  resolveTableTabDefault(props.module.config ?? {})
)

const tabGrouping = computed(() =>
  detectTableTabGroups(
    visibleColumns.value,
    tabGroupSeparator.value,
    tabSharedColumns.value
  )
)

const tabGroups = computed(() =>
  [...tabGrouping.value.groups.entries()].map(([name, columns]) => ({
    name,
    columns
  }))
)

const sharedColumns = computed(() => tabGrouping.value.shared)
const hasDetectedGroups = computed(() => tabGroups.value.length > 0)
const showTabBar = computed(() => tabGroups.value.length > 1)

watch(
  [tabGroups, tabDefault],
  ([groups, defaultTab]) => {
    if (!groups.length) {
      activeTab.value = ''
      return
    }

    if (defaultTab && groups.some((group) => group.name === defaultTab)) {
      activeTab.value = defaultTab
      return
    }

    if (groups.some((group) => group.name === activeTab.value)) {
      return
    }

    activeTab.value = groups[0]?.name ?? ''
  },
  { immediate: true }
)

const activeTabGroup = computed(() => {
  if (!tabGroups.value.length) {
    return null
  }
  return tabGroups.value.find((group) => group.name === activeTab.value) ?? tabGroups.value[0]
})

const activeTabGroupColumns = computed(() =>
  new Set(activeTabGroup.value?.columns ?? [])
)

const activeColumns = computed(() => {
  if (!hasDetectedGroups.value) {
    return visibleColumns.value
  }

  const columns = [
    ...sharedColumns.value,
    ...(activeTabGroup.value?.columns ?? [])
  ]
  const selected = new Set(columns)
  return visibleColumns.value.filter((column) => selected.has(column))
})

const tableColumns = computed(() =>
  activeColumns.value.map((column) => ({
    key: column,
    label:
      hasDetectedGroups.value && activeTabGroupColumns.value.has(column)
        ? stripTableTabGroupPrefix(
            column,
            activeTabGroup.value?.name ?? '',
            tabGroupSeparator.value
          )
        : column
  }))
)

const columnValueFormats = computed(() =>
  resolveTableColumnValueFormats(visibleColumns.value, props.module.config)
)

const columnColors = computed(() =>
  resolveColumnColors(visibleColumns.value, props.module.config)
)

const columnGradients = computed(() =>
  resolveColumnGradients(visibleColumns.value, props.module.config)
)

const conditionalRules = computed(() =>
  parseConditionalFormattingRules(props.module.config.conditionalFormatting)
)

const columnExtents = computed(() =>
  getColumnNumericExtents(filteredRows.value, visibleColumns.value)
)

const cellStyleResolver = (input: { columnKey: string; value: unknown }) => {
  const columnColor = columnColors.value[input.columnKey]
  const gradientEnabled = columnGradients.value[input.columnKey] === true
  const gradientStyle = gradientEnabled
    ? getColumnGradientStyle(
        input.columnKey,
        input.value,
        columnExtents.value[input.columnKey],
        columnColor ?? '#2563eb'
      )
    : null

  const baseStyle = gradientStyle
    ? { ...gradientStyle }
    : columnColor
      ? { backgroundColor: `${columnColor}20` }
      : undefined

  return getConditionalCellStyle({
    columnKey: input.columnKey,
    value: input.value,
    rules: conditionalRules.value,
    columnExtents: columnExtents.value,
    baseStyle
  })
}

const cellValueFormatter = (input: { columnKey: string; defaultValue: string; value: unknown }) =>
  formatTableCellDisplayValue(
    input.defaultValue,
    input.columnKey,
    columnValueFormats.value,
    input.value,
    useThousandsSeparator.value
  )

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

    <div
      v-if="showTabBar"
      class="flex flex-wrap gap-1 border-b border-gray-200 pb-2"
      :class="showSearch ? 'mt-2' : ''"
    >
      <button
        v-for="group in tabGroups"
        :key="group.name"
        class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="
          activeTab === group.name
            ? 'bg-brand-primary text-white'
            : 'border border-gray-200 text-gray-600 hover:border-gray-300'
        "
        @click="activeTab = group.name"
      >
        {{ group.name }}
      </button>
    </div>

    <p v-if="!tableColumns.length" class="mt-4 text-sm text-gray-500">
      No data available.
    </p>

    <div
      v-else
      :class="showSearch || showTabBar ? 'mt-3 min-h-0 flex-1 overflow-auto' : 'min-h-0 flex-1 overflow-auto'"
    >
      <Table
        :rows="filteredRows"
        :columns="tableColumns"
        :cell-style-resolver="cellStyleResolver"
        :cell-value-formatter="cellValueFormatter"
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
