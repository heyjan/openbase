<script setup lang="ts">
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Blend,
  Calculator,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  Palette,
  RotateCcw,
  Search,
  Trash2
} from 'lucide-vue-next'
import type {
  ConditionalFormatRule,
  QueryPreviewVisualization,
  ScatterCompareSeriesOption,
  ScatterVizMode,
  TableColumnValueFormat,
  VizSeriesOption
} from '~/types/viz-options'
import {
  detectTableTabGroups,
  getCategoryColumns,
  getNumericColumns,
  parseConditionalFormattingRules,
  resolveColumnColors,
  resolveColumnGradients,
  resolveTableColumnOrder,
  resolveTableColumnValueFormats,
  resolveTableTabDefault,
  resolveTableTabGroupSeparator,
  resolveTableTabSharedColumns,
  resolveTableVisibleColumns,
  toNumber
} from '~/composables/useVizConfig'

const props = withDefaults(
  defineProps<{
    vizType: QueryPreviewVisualization
    columns: string[]
    rows: Record<string, unknown>[]
    modelValue: Record<string, unknown>
    customOptionsCount?: number
    isModified?: boolean
  }>(),
  {
    customOptionsCount: 0,
    isModified: false
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, unknown>): void
  (event: 'reset'): void
}>()

const isOpen = ref(false)
const draggingColumn = ref('')
const SELECT_NONE_VALUE = '__none__'
const DEFAULT_SERIES_COLORS = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']
const sharedSelectProps = {
  content: {
    position: 'popper' as const,
    side: 'bottom' as const,
    sideOffset: 6,
    collisionPadding: 12
  },
  ui: {
    content: 'z-[120] bg-white shadow-xl ring-1 ring-gray-200'
  }
}

const numericColumns = computed(() => getNumericColumns(props.rows, props.columns))
const categoryColumns = computed(() => getCategoryColumns(props.columns, numericColumns.value))
const kpiValueFieldOptions = computed(() =>
  numericColumns.value.length ? numericColumns.value : props.columns
)

const sharedTitle = computed(() =>
  typeof props.modelValue.titleOverride === 'string' ? props.modelValue.titleOverride : ''
)

const emitNext = (next: Record<string, unknown>) => {
  emit('update:modelValue', {
    ...next
  })
}

const updateConfig = (patch: Record<string, unknown>) => {
  emitNext({
    ...props.modelValue,
    ...patch
  })
}

const updateString = (key: string, value: unknown) => {
  updateConfig({
    [key]: typeof value === 'string' ? value : String(value ?? '')
  })
}

const updateOptionalString = (key: string, value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  const next = { ...props.modelValue }
  if (text) {
    next[key] = text
  } else {
    delete next[key]
  }
  emitNext(next)
}

const updateOptionalRawString = (key: string, value: unknown) => {
  const text = typeof value === 'string' ? value : String(value ?? '')
  const next = { ...props.modelValue }
  if (text.length > 0) {
    next[key] = text
  } else {
    delete next[key]
  }
  emitNext(next)
}

const updateOptionalNumber = (key: string, value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!text) {
    const next = { ...props.modelValue }
    delete next[key]
    emitNext(next)
    return
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    return
  }

  updateConfig({
    [key]: parsed
  })
}

const updateInteger = (key: string, value: unknown, fallback: number) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  const parsed = Number(text)

  updateConfig({
    [key]: Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
  })
}

const updateBoolean = (key: string, value: boolean) => {
  updateConfig({ [key]: value })
}

const sliderToNumber = (value: number | number[] | undefined, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === 'number' && Number.isFinite(value[0])) {
    return value[0]
  }

  return fallback
}

const readBoolean = (key: string, fallback: boolean) => {
  const value = props.modelValue[key]
  return typeof value === 'boolean' ? value : fallback
}

const readNumber = (key: string, fallback: number) => {
  const value = props.modelValue[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const readString = (key: string, fallback = '') => {
  const value = props.modelValue[key]
  return typeof value === 'string' ? value : fallback
}

const readOptionalNumericText = (key: string) => {
  const value = props.modelValue[key]
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

const toSelectValue = (value: unknown) => {
  return typeof value === 'string' && value.trim() ? value : SELECT_NONE_VALUE
}

const fromSelectValue = (value: unknown) => {
  if (typeof value !== 'string' || value === SELECT_NONE_VALUE || !value.trim()) {
    return undefined
  }
  return value
}

const orderedColumns = computed(() =>
  resolveTableColumnOrder(props.columns, props.modelValue)
)

const visibleColumns = computed(() =>
  resolveTableVisibleColumns(orderedColumns.value, props.modelValue)
)

const tableTabbedEnabled = computed(() =>
  readBoolean('tabbed', false)
)

const tableTabGroupSeparator = computed(() =>
  resolveTableTabGroupSeparator(props.modelValue)
)

const tableTabSharedColumns = computed(() =>
  resolveTableTabSharedColumns(orderedColumns.value, props.modelValue)
)

const tableTabDefault = computed(() =>
  resolveTableTabDefault(props.modelValue)
)

const tableTabGroups = computed(() =>
  [...detectTableTabGroups(
    orderedColumns.value,
    tableTabGroupSeparator.value,
    tableTabSharedColumns.value
  ).groups.keys()]
)

const columnValueFormats = computed(() =>
  resolveTableColumnValueFormats(props.columns, props.modelValue)
)

const columnColors = computed(() =>
  resolveColumnColors(orderedColumns.value, props.modelValue)
)

const columnGradients = computed(() =>
  resolveColumnGradients(orderedColumns.value, props.modelValue)
)

const visibleColumnsSet = computed(() => new Set(visibleColumns.value))

const sortDirection = computed<'asc' | 'desc'>(() =>
  readString('sortDirection', 'asc') === 'desc' ? 'desc' : 'asc'
)

const isColumnVisible = (column: string) =>
  visibleColumnsSet.value.has(column)

const moveColumn = (column: string, direction: -1 | 1) => {
  const order = [...orderedColumns.value]
  const index = order.indexOf(column)

  if (index < 0) {
    return
  }

  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= order.length) {
    return
  }

  const [moved] = order.splice(index, 1)
  order.splice(nextIndex, 0, moved)

  updateConfig({
    columnOrder: order
  })
}

const onColumnDragStart = (column: string, event: DragEvent) => {
  draggingColumn.value = column
  event.dataTransfer?.setData('text/plain', column)
  event.dataTransfer?.setDragImage((event.target as HTMLElement) ?? document.body, 8, 8)
}

const onColumnDrop = (target: string, event: DragEvent) => {
  event.preventDefault()

  const source =
    draggingColumn.value || event.dataTransfer?.getData('text/plain') || ''

  draggingColumn.value = ''

  if (!source || source === target) {
    return
  }

  const order = [...orderedColumns.value]
  const sourceIndex = order.indexOf(source)
  const targetIndex = order.indexOf(target)

  if (sourceIndex < 0 || targetIndex < 0) {
    return
  }

  const [moved] = order.splice(sourceIndex, 1)
  order.splice(targetIndex, 0, moved)

  updateConfig({
    columnOrder: order
  })
}

const toggleVisibleColumn = (column: string) => {
  const set = new Set(visibleColumnsSet.value)
  if (set.has(column)) {
    set.delete(column)
  } else {
    set.add(column)
  }

  updateConfig({
    visibleColumns: orderedColumns.value.filter((entry) => set.has(entry))
  })
}

const toggleTabSharedColumn = (column: string) => {
  const next = new Set(tableTabSharedColumns.value)
  if (next.has(column)) {
    next.delete(column)
  } else {
    next.add(column)
  }

  const nextColumns = orderedColumns.value.filter((entry) => next.has(entry))
  const nextConfig = { ...props.modelValue }

  if (nextColumns.length) {
    nextConfig.tabSharedColumns = nextColumns
  } else {
    delete nextConfig.tabSharedColumns
  }

  delete nextConfig.tab_shared_columns
  emitNext(nextConfig)
}

const updateColumnColor = (column: string, color: string) => {
  updateConfig({
    columnColors: {
      ...columnColors.value,
      [column]: color
    }
  })
}

const clearColumnColor = (column: string) => {
  const next = { ...columnColors.value }
  delete next[column]
  updateConfig({
    columnColors: Object.keys(next).length ? next : undefined
  })
}

const toggleColumnGradient = (column: string) => {
  const next = { ...columnGradients.value }
  if (next[column]) {
    delete next[column]
  } else {
    next[column] = true
  }

  updateConfig({
    columnGradients: Object.keys(next).length ? next : undefined
  })
}

const updateColumnValueFormat = (
  column: string,
  key: keyof TableColumnValueFormat,
  rawValue: unknown
) => {
  const text = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')
  const next: Record<string, TableColumnValueFormat> = {
    ...columnValueFormats.value
  }
  const current: TableColumnValueFormat = {
    ...(next[column] ?? {})
  }

  if (text.trim()) {
    current[key] = text
  } else {
    delete current[key]
  }

  if (!current.prefix && !current.suffix) {
    delete next[column]
  } else {
    next[column] = current
  }

  updateConfig({
    columnValueFormats: next
  })
}

const currentSeries = computed<VizSeriesOption[]>(() => {
  const raw = props.modelValue.series
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const record = entry as Record<string, unknown>
      const field = typeof record.field === 'string' ? record.field.trim() : ''
      if (!field) {
        return null
      }
      return {
        field,
        label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : field,
        color:
          typeof record.color === 'string' && record.color.trim()
            ? record.color.trim()
            : '#2563eb'
      }
    })
    .filter((entry): entry is VizSeriesOption => entry !== null)
})

const seriesCandidateFields = computed(() => {
  if (
    props.vizType === 'pie' ||
    props.vizType === 'scatter' ||
    props.vizType === 'table' ||
    props.vizType === 'waterfall'
  ) {
    return []
  }

  const xField = readString('xField')
  const candidates = numericColumns.value.filter((column) => column !== xField)
  return candidates.length ? candidates : numericColumns.value
})

const toggleSeriesField = (field: string, checked: boolean) => {
  const byField = new Map(currentSeries.value.map((entry) => [entry.field, entry]))

  if (checked) {
    if (!byField.has(field)) {
      byField.set(field, {
        field,
        label: field,
        color: '#2563eb'
      })
    }
  } else {
    byField.delete(field)
  }

  updateConfig({
    series: seriesCandidateFields.value
      .filter((candidate) => byField.has(candidate))
      .map((candidate, index) => {
        const existing = byField.get(candidate)
        return {
          field: candidate,
          label: existing?.label ?? candidate,
          color: existing?.color ?? DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]
        }
      })
  })
}

const updateSeries = (index: number, patch: Partial<VizSeriesOption>) => {
  const next = [...currentSeries.value]
  const current = next[index]
  if (!current) {
    return
  }

  next[index] = {
    ...current,
    ...patch
  }

  updateConfig({
    series: next
  })
}

const scatterMode = computed<ScatterVizMode>(() =>
  readString('mode') === 'category_compare' ? 'category_compare' : 'numeric'
)
const SCATTER_LABEL_ROTATION_OPTIONS: Array<{ label: string; value: 0 | 45 | 90 }> = [
  { label: '0°', value: 0 },
  { label: '45°', value: 45 },
  { label: '90°', value: 90 }
]

const parseScatterLabelRotation = (value: unknown): 0 | 45 | 90 => {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value
  if (parsed === 45 || parsed === 90) {
    return parsed
  }
  return 0
}

const scatterCategoryLabelRotation = computed(() =>
  parseScatterLabelRotation(
    props.modelValue.categoryLabelRotation ??
      props.modelValue.category_label_rotation ??
      props.modelValue.xAxisLabelRotation ??
      props.modelValue.x_axis_label_rotation ??
      props.modelValue.axisLabelRotate ??
      props.modelValue.axis_label_rotate
  )
)

const scatterSeriesCandidateFields = computed(() => numericColumns.value)

const scatterCompareSeries = computed<ScatterCompareSeriesOption[]>(() => {
  const raw = props.modelValue.series
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const field = typeof record.field === 'string' ? record.field.trim() : ''
      if (!field || !scatterSeriesCandidateFields.value.includes(field)) {
        return null
      }

      const label =
        typeof record.label === 'string' && record.label.trim() ? record.label.trim() : field
      const color =
        typeof record.color === 'string' && record.color.trim()
          ? record.color.trim()
          : DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]
      const sizeField =
        typeof record.sizeField === 'string' &&
        record.sizeField.trim() &&
        scatterSeriesCandidateFields.value.includes(record.sizeField.trim())
          ? record.sizeField.trim()
          : field

      return {
        field,
        label,
        color,
        sizeField
      } satisfies ScatterCompareSeriesOption
    })
    .filter((entry): entry is ScatterCompareSeriesOption => entry !== null)
})

const setScatterMode = (value: unknown) => {
  updateConfig({
    mode: value === 'category_compare' ? 'category_compare' : 'numeric'
  })
}

const setScatterCategoryLabelRotation = (value: unknown) => {
  updateConfig({
    categoryLabelRotation: parseScatterLabelRotation(value)
  })
}

const toggleScatterSeriesField = (field: string, checked: boolean) => {
  const byField = new Map(scatterCompareSeries.value.map((entry) => [entry.field, entry]))

  if (checked) {
    if (!byField.has(field)) {
      byField.set(field, {
        field,
        label: field,
        color: '#2563eb',
        sizeField: field
      })
    }
  } else {
    byField.delete(field)
  }

  updateConfig({
    series: scatterSeriesCandidateFields.value
      .filter((candidate) => byField.has(candidate))
      .map((candidate, index) => {
        const existing = byField.get(candidate)
        const fallbackSizeField = scatterSeriesCandidateFields.value.includes(candidate)
          ? candidate
          : scatterSeriesCandidateFields.value[0] ?? candidate

        return {
          field: candidate,
          label: existing?.label ?? candidate,
          color: existing?.color ?? DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length],
          sizeField:
            existing?.sizeField && scatterSeriesCandidateFields.value.includes(existing.sizeField)
              ? existing.sizeField
              : fallbackSizeField
        } satisfies ScatterCompareSeriesOption
      })
  })
}

const updateScatterSeries = (index: number, patch: Partial<ScatterCompareSeriesOption>) => {
  const next = [...scatterCompareSeries.value]
  const current = next[index]
  if (!current) {
    return
  }

  next[index] = {
    ...current,
    ...patch
  }

  updateConfig({
    series: next
  })
}

const conditionalRules = computed(() =>
  parseConditionalFormattingRules(props.modelValue.conditionalFormatting)
)

const ruleOperators: Array<{ label: string; value: ConditionalFormatRule['operator'] }> = [
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' },
  { label: '=', value: 'eq' },
  { label: '!=', value: 'neq' },
  { label: 'Between', value: 'between' },
  { label: 'Contains', value: 'contains' }
]

const ruleStyles: Array<{ label: string; value: ConditionalFormatRule['style'] }> = [
  { label: 'Background', value: 'background' },
  { label: 'Text', value: 'text' },
  { label: 'Bar', value: 'bar' }
]

const addRule = () => {
  const column = props.columns[0] ?? ''
  if (!column) {
    return
  }

  updateConfig({
    conditionalFormatting: [
      ...conditionalRules.value,
      {
        column,
        operator: 'gt',
        value: 0,
        style: 'background',
        color: '#fca5a5'
      } satisfies ConditionalFormatRule
    ]
  })
}

const removeRule = (index: number) => {
  updateConfig({
    conditionalFormatting: conditionalRules.value.filter((_, ruleIndex) => ruleIndex !== index)
  })
}

const normalizeRuleValue = (column: string, rawValue: unknown, operator: ConditionalFormatRule['operator']) => {
  if (operator === 'contains') {
    return typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')
  }

  const numeric = toNumber(rawValue)
  if (numeric !== null && numericColumns.value.includes(column)) {
    return numeric
  }

  return typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')
}

const updateRule = (index: number, patch: Partial<ConditionalFormatRule>) => {
  const next = [...conditionalRules.value]
  const current = next[index]
  if (!current) {
    return
  }

  const merged = {
    ...current,
    ...patch
  }

  merged.value = normalizeRuleValue(merged.column, merged.value, merged.operator)

  if (merged.operator !== 'between') {
    delete merged.valueTo
  }

  next[index] = merged

  updateConfig({
    conditionalFormatting: next
  })
}

watch(
  () => props.vizType,
  () => {
    isOpen.value = false
  }
)
</script>

<template>
  <section class="rounded border border-gray-200 bg-white">
    <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
      <button
        class="inline-flex items-center gap-2 text-sm font-medium text-gray-800"
        type="button"
        @click="isOpen = !isOpen"
      >
        <span>{{ isOpen ? 'Hide options' : 'Show options' }}</span>
      </button>

      <div class="flex items-center gap-2 text-xs text-gray-500">
        <span v-if="!isOpen">{{ customOptionsCount }} custom options</span>
        <UButton
          v-if="isModified"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="emit('reset')"
        >
          <RotateCcw class="h-3.5 w-3.5" />
        </UButton>
      </div>
    </div>

    <div v-if="isOpen" class="space-y-4 p-3">
      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Title override
        <UInput
          class="mt-1"
          :model-value="sharedTitle"
          @update:model-value="updateString('titleOverride', $event)"
        />
      </label>

      <template v-if="vizType === 'table'">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
              <Search class="h-3.5 w-3.5" />
              Search bar
            </p>
            <div class="mt-2 flex justify-end">
              <USwitch
                :model-value="readBoolean('showSearch', false)"
                @update:model-value="updateBoolean('showSearch', $event)"
              />
            </div>
          </div>

          <label class="block rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <span class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
              <ArrowUpDown class="h-3.5 w-3.5" />
              Sort column
            </span>
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                { label: 'None', value: SELECT_NONE_VALUE },
                ...orderedColumns.map((column) => ({ label: column, value: column }))
              ]"
              :model-value="toSelectValue(readString('sortColumn'))"
              @update:model-value="updateConfig({ sortColumn: fromSelectValue($event) })"
            />
          </label>

          <label class="block rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <span class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
              <component :is="sortDirection === 'desc' ? ArrowDownAZ : ArrowUpAZ" class="h-3.5 w-3.5" />
              Sort direction
            </span>
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                { label: 'Ascending', value: 'asc' },
                { label: 'Descending', value: 'desc' }
              ]"
              :model-value="sortDirection"
              @update:model-value="updateConfig({ sortDirection: $event === 'desc' ? 'desc' : 'asc' })"
            />
          </label>

          <label class="block rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <span class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
              <Hash class="h-3.5 w-3.5" />
              Row limit
            </span>
            <UInput
              class="mt-1"
              type="number"
              :model-value="String(readNumber('rowLimit', 500))"
              @update:model-value="updateInteger('rowLimit', $event, 500)"
            />
          </label>

          <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <p class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
              <Calculator class="h-3.5 w-3.5" />
              Thousands format
            </p>
            <div class="mt-2 flex justify-end">
              <USwitch
                :model-value="readBoolean('useThousandsSeparator', false)"
                @update:model-value="updateBoolean('useThousandsSeparator', $event)"
              />
            </div>
          </div>
        </div>

        <div class="rounded border border-gray-200 bg-gray-50 p-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Tabbed</p>
            <USwitch
              :model-value="tableTabbedEnabled"
              @update:model-value="updateBoolean('tabbed', $event)"
            />
          </div>

          <div v-if="tableTabbedEnabled" class="mt-3 space-y-3">
            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Separator
              <UInput
                class="mt-1"
                :model-value="typeof modelValue.tabGroupSeparator === 'string' ? modelValue.tabGroupSeparator : ''"
                @update:model-value="updateOptionalRawString('tabGroupSeparator', $event)"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Default tab
              <UInput
                class="mt-1"
                :model-value="tableTabDefault"
                list="table-tab-defaults"
                @update:model-value="updateOptionalString('tabDefault', $event)"
              />
              <datalist id="table-tab-defaults">
                <option
                  v-for="tab in tableTabGroups"
                  :key="`tab-option-${tab}`"
                  :value="tab"
                />
              </datalist>
            </label>

            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Shared columns</p>
              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <label
                  v-for="column in orderedColumns"
                  :key="`tab-shared-${column}`"
                  class="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                >
                  <input
                    type="checkbox"
                    :checked="tableTabSharedColumns.includes(column)"
                    @change="toggleTabSharedColumn(column)"
                  >
                  <span class="truncate">{{ column }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Columns</p>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="column in orderedColumns"
              :key="`column-${column}`"
              draggable="true"
              :class="[
                'rounded border border-gray-200 bg-gray-50 px-2 py-2 text-sm',
                isColumnVisible(column) ? 'opacity-100' : 'opacity-50'
              ]"
              @dragstart="onColumnDragStart(column, $event)"
              @dragover.prevent
              @drop="onColumnDrop(column, $event)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex min-w-0 items-center gap-2">
                  <GripVertical class="h-3.5 w-3.5 text-gray-400" />
                  <span class="truncate text-gray-700">{{ column }}</span>
                </span>

                <span class="inline-flex shrink-0 items-center gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :title="isColumnVisible(column) ? 'Hide column' : 'Show column'"
                    @click="toggleVisibleColumn(column)"
                  >
                    <component :is="isColumnVisible(column) ? Eye : EyeOff" class="h-3.5 w-3.5" />
                  </UButton>

                  <label
                    class="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white"
                    title="Column color"
                  >
                    <input
                      :value="columnColors[column] ?? '#2563eb'"
                      type="color"
                      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      @input="updateColumnColor(column, ($event.target as HTMLInputElement).value)"
                    >
                    <span
                      v-if="columnColors[column]"
                      class="h-3.5 w-3.5 rounded border border-gray-300"
                      :style="{ backgroundColor: columnColors[column] }"
                    />
                    <Palette v-else class="h-3.5 w-3.5 text-gray-500" />
                  </label>

                  <UButton
                    v-if="columnColors[column]"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    title="Clear color"
                    @click="clearColumnColor(column)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </UButton>

                  <UButton
                    v-if="numericColumns.includes(column)"
                    color="neutral"
                    :variant="columnGradients[column] ? 'solid' : 'ghost'"
                    size="xs"
                    title="Gradient shading"
                    @click="toggleColumnGradient(column)"
                  >
                    <Blend class="h-3.5 w-3.5" />
                  </UButton>

                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    title="Move up"
                    @click="moveColumn(column, -1)"
                  >↑</UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    title="Move down"
                    @click="moveColumn(column, 1)"
                  >↓</UButton>
                </span>
              </div>

              <div class="mt-2 grid grid-cols-2 gap-2">
                <UInput
                  :model-value="columnValueFormats[column]?.prefix ?? ''"
                  placeholder="Prefix"
                  @update:model-value="updateColumnValueFormat(column, 'prefix', $event)"
                />
                <UInput
                  :model-value="columnValueFormats[column]?.suffix ?? ''"
                  placeholder="Suffix"
                  @update:model-value="updateColumnValueFormat(column, 'suffix', $event)"
                />
              </div>
            </li>
          </ul>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Conditional formatting</p>
            <UButton color="neutral" variant="outline" size="xs" @click="addRule">Add rule</UButton>
          </div>

          <div v-if="!conditionalRules.length" class="rounded border border-gray-200 bg-gray-50 px-2 py-2 text-sm text-gray-500">
            No rules
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(rule, index) in conditionalRules"
              :key="`rule-${index}`"
              class="grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 md:grid-cols-7"
            >
              <USelect
                v-bind="sharedSelectProps"
                :items="columns.map((column) => ({ label: column, value: column }))"
                :model-value="rule.column"
                @update:model-value="updateRule(index, { column: String($event || '') })"
              />

              <USelect
                v-bind="sharedSelectProps"
                :items="ruleOperators"
                :model-value="rule.operator"
                @update:model-value="updateRule(index, { operator: ($event || 'gt') as ConditionalFormatRule['operator'] })"
              />

              <UInput
                :model-value="String(rule.value ?? '')"
                @update:model-value="updateRule(index, { value: $event as string })"
              />

              <UInput
                v-if="rule.operator === 'between'"
                :model-value="String(rule.valueTo ?? '')"
                @update:model-value="updateRule(index, { valueTo: toNumber($event) ?? undefined })"
              />
              <div v-else class="hidden md:block" />

              <USelect
                v-bind="sharedSelectProps"
                :items="ruleStyles"
                :model-value="rule.style"
                @update:model-value="updateRule(index, { style: ($event || 'background') as ConditionalFormatRule['style'] })"
              />

              <input
                :value="rule.color"
                type="color"
                class="h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
                @input="updateRule(index, { color: ($event.target as HTMLInputElement).value })"
              >

              <div class="flex items-center justify-end gap-2">
                <input
                  v-if="rule.style === 'bar'"
                  :value="rule.colorTo ?? '#ffffff'"
                  type="color"
                  class="h-9 w-14 cursor-pointer rounded border border-gray-300 bg-white px-1"
                  @input="updateRule(index, { colorTo: ($event.target as HTMLInputElement).value })"
                >
                <UButton color="error" variant="ghost" size="xs" @click="removeRule(index)">
                  <Trash2 class="h-4 w-4" />
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="vizType === 'kpi'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Label
            <UInput
              class="mt-1"
              :model-value="readString('label')"
              @update:model-value="updateString('label', $event)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Value field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="kpiValueFieldOptions.map((column) => ({ label: column, value: column }))"
              :model-value="readString('valueField')"
              @update:model-value="updateConfig({ valueField: String($event || '') })"
            />
          </label>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Prefix
            <UInput
              class="mt-1"
              :model-value="readString('prefix')"
              @update:model-value="updateString('prefix', $event)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Postfix
            <UInput
              class="mt-1"
              :model-value="readString('postfix')"
              @update:model-value="updateString('postfix', $event)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Value color
            <input
              :value="readString('valueColor', '#111827')"
              type="color"
              class="mt-1 h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateConfig({ valueColor: ($event.target as HTMLInputElement).value })"
            >
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'line' || vizType === 'area'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            X-axis field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                ...categoryColumns.map((column) => ({ label: column, value: column })),
                ...numericColumns
                  .filter((column) => !categoryColumns.includes(column))
                  .map((column) => ({ label: column, value: column }))
              ]"
              :model-value="readString('xField')"
              @update:model-value="updateConfig({ xField: String($event || '') })"
            />
          </label>
        </div>

        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Series fields</p>
          <div class="mt-2 grid gap-1 md:grid-cols-3">
            <label
              v-for="field in seriesCandidateFields"
              :key="`line-series-${field}`"
              class="inline-flex items-center gap-2 text-sm text-gray-700"
            >
              <input
                :checked="currentSeries.some((entry) => entry.field === field)"
                type="checkbox"
                class="h-4 w-4 rounded border border-gray-300"
                @change="toggleSeriesField(field, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ field }}</span>
            </label>
          </div>
        </div>

        <div v-if="currentSeries.length" class="space-y-2">
          <div
            v-for="(series, index) in currentSeries"
            :key="`line-series-options-${series.field}`"
            class="grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 md:grid-cols-[1fr_120px]"
          >
            <UInput
              :model-value="series.label ?? series.field"
              @update:model-value="updateSeries(index, { label: String($event || '') })"
            />
            <input
              :value="series.color ?? '#2563eb'"
              type="color"
              class="h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateSeries(index, { color: ($event.target as HTMLInputElement).value })"
            >
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-4">
          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Smooth
            <USwitch :model-value="readBoolean('smooth', true)" @update:model-value="updateBoolean('smooth', $event)" />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show points
            <USwitch :model-value="readBoolean('showSymbols', false)" @update:model-value="updateBoolean('showSymbols', $event)" />
          </label>

          <label
            v-if="vizType === 'area'"
            class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            Fill area
            <USwitch :model-value="readBoolean('area', true)" @update:model-value="updateBoolean('area', $event)" />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show legend
            <USwitch :model-value="readBoolean('showLegend', true)" @update:model-value="updateBoolean('showLegend', $event)" />
          </label>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Y-axis min
            <UInput
              class="mt-1"
              type="number"
              :model-value="readOptionalNumericText('yAxisMin')"
              @update:model-value="updateOptionalNumber('yAxisMin', $event)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Y-axis max
            <UInput
              class="mt-1"
              type="number"
              :model-value="readOptionalNumericText('yAxisMax')"
              @update:model-value="updateOptionalNumber('yAxisMax', $event)"
            />
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'bar' || vizType === 'stacked_horizontal_bar'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            X-axis field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                ...categoryColumns.map((column) => ({ label: column, value: column })),
                ...numericColumns
                  .filter((column) => !categoryColumns.includes(column))
                  .map((column) => ({ label: column, value: column }))
              ]"
              :model-value="readString('xField')"
              @update:model-value="updateConfig({ xField: String($event || '') })"
            />
          </label>
        </div>

        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Series fields</p>
          <div class="mt-2 grid gap-1 md:grid-cols-3">
            <label
              v-for="field in seriesCandidateFields"
              :key="`bar-series-${field}`"
              class="inline-flex items-center gap-2 text-sm text-gray-700"
            >
              <input
                :checked="currentSeries.some((entry) => entry.field === field)"
                type="checkbox"
                class="h-4 w-4 rounded border border-gray-300"
                @change="toggleSeriesField(field, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ field }}</span>
            </label>
          </div>
        </div>

        <div v-if="currentSeries.length" class="space-y-2">
          <div
            v-for="(series, index) in currentSeries"
            :key="`bar-series-options-${series.field}`"
            class="grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 md:grid-cols-[1fr_120px]"
          >
            <UInput
              :model-value="series.label ?? series.field"
              @update:model-value="updateSeries(index, { label: String($event || '') })"
            />
            <input
              :value="series.color ?? '#2563eb'"
              type="color"
              class="h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateSeries(index, { color: ($event.target as HTMLInputElement).value })"
            >
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-4">
          <label
            v-if="vizType === 'bar'"
            class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            Stacked
            <USwitch :model-value="readBoolean('stacked', false)" @update:model-value="updateBoolean('stacked', $event)" />
          </label>

          <label
            v-if="vizType === 'bar'"
            class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            Horizontal
            <USwitch :model-value="readBoolean('horizontal', false)" @update:model-value="updateBoolean('horizontal', $event)" />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show legend
            <USwitch :model-value="readBoolean('showLegend', true)" @update:model-value="updateBoolean('showLegend', $event)" />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Border radius
            <USlider
              class="mt-2"
              :min="0"
              :max="12"
              :step="1"
              :model-value="readNumber('barBorderRadius', 4)"
              @update:model-value="updateConfig({ barBorderRadius: sliderToNumber($event, 4) })"
            />
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'waterfall'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Category field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="columns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('categoryField')"
              @update:model-value="updateConfig({ categoryField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Value field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="numericColumns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('valueField')"
              @update:model-value="updateConfig({ valueField: String($event || '') })"
            />
          </label>
        </div>

        <div class="grid gap-3 md:grid-cols-4">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Increase color
            <input
              :value="readString('positiveColor', '#16a34a')"
              type="color"
              class="mt-1 h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateConfig({ positiveColor: ($event.target as HTMLInputElement).value })"
            >
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Decrease color
            <input
              :value="readString('negativeColor', '#dc2626')"
              type="color"
              class="mt-1 h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateConfig({ negativeColor: ($event.target as HTMLInputElement).value })"
            >
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Total color
            <input
              :value="readString('totalColor', '#2563eb')"
              type="color"
              class="mt-1 h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateConfig({ totalColor: ($event.target as HTMLInputElement).value })"
            >
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Border radius
            <USlider
              class="mt-2"
              :min="0"
              :max="12"
              :step="1"
              :model-value="readNumber('barBorderRadius', 4)"
              @update:model-value="updateConfig({ barBorderRadius: sliderToNumber($event, 4) })"
            />
          </label>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show legend
            <USwitch :model-value="readBoolean('showLegend', false)" @update:model-value="updateBoolean('showLegend', $event)" />
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'radar'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Axis field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                ...categoryColumns.map((column) => ({ label: column, value: column })),
                ...numericColumns
                  .filter((column) => !categoryColumns.includes(column))
                  .map((column) => ({ label: column, value: column }))
              ]"
              :model-value="readString('xField')"
              @update:model-value="updateConfig({ xField: String($event || '') })"
            />
          </label>
        </div>

        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Series fields</p>
          <div class="mt-2 grid gap-1 md:grid-cols-3">
            <label
              v-for="field in seriesCandidateFields"
              :key="`radar-series-${field}`"
              class="inline-flex items-center gap-2 text-sm text-gray-700"
            >
              <input
                :checked="currentSeries.some((entry) => entry.field === field)"
                type="checkbox"
                class="h-4 w-4 rounded border border-gray-300"
                @change="toggleSeriesField(field, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ field }}</span>
            </label>
          </div>
        </div>

        <div v-if="currentSeries.length" class="space-y-2">
          <div
            v-for="(series, index) in currentSeries"
            :key="`radar-series-options-${series.field}`"
            class="grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 md:grid-cols-[1fr_120px]"
          >
            <UInput
              :model-value="series.label ?? series.field"
              @update:model-value="updateSeries(index, { label: String($event || '') })"
            />
            <input
              :value="series.color ?? '#2563eb'"
              type="color"
              class="h-9 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
              @input="updateSeries(index, { color: ($event.target as HTMLInputElement).value })"
            >
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show legend
            <USwitch :model-value="readBoolean('showLegend', true)" @update:model-value="updateBoolean('showLegend', $event)" />
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'pie'">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Category field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="columns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('categoryField')"
              @update:model-value="updateConfig({ categoryField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Value field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="numericColumns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('valueField')"
              @update:model-value="updateConfig({ valueField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Top N
            <UInput
              class="mt-1"
              type="number"
              :model-value="String(readNumber('topN', 8))"
              @update:model-value="updateInteger('topN', $event, 8)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Donut
            <USwitch :model-value="readBoolean('donut', true)" @update:model-value="updateBoolean('donut', $event)" />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show labels
            <USwitch :model-value="readBoolean('showLabels', false)" @update:model-value="updateBoolean('showLabels', $event)" />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            Show legend
            <USwitch :model-value="readBoolean('showLegend', true)" @update:model-value="updateBoolean('showLegend', $event)" />
          </label>
        </div>
      </template>

      <template v-else-if="vizType === 'scatter'">
        <div class="space-y-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Scatter mode
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                { label: 'Numeric relation', value: 'numeric' },
                { label: 'Category compare (bubble)', value: 'category_compare' }
              ]"
              :model-value="scatterMode"
              @update:model-value="setScatterMode($event)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            Show labels
            <USwitch :model-value="readBoolean('showLabels', false)" @update:model-value="updateBoolean('showLabels', $event)" />
          </label>
        </div>

        <div v-if="scatterMode === 'numeric'" class="mt-3 space-y-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            X field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="numericColumns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('xField')"
              @update:model-value="updateConfig({ xField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Y field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="numericColumns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('yField')"
              @update:model-value="updateConfig({ yField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Size field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                { label: 'None', value: SELECT_NONE_VALUE },
                ...numericColumns.map((column) => ({ label: column, value: column }))
              ]"
              :model-value="toSelectValue(readString('sizeField'))"
              @update:model-value="updateConfig({ sizeField: fromSelectValue($event) })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Label field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="[
                { label: 'None', value: SELECT_NONE_VALUE },
                ...columns.map((column) => ({ label: column, value: column }))
              ]"
              :model-value="toSelectValue(readString('labelField'))"
              @update:model-value="updateConfig({ labelField: fromSelectValue($event) })"
            />
          </label>
        </div>

        <div v-else class="mt-3 space-y-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Category field
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="columns.map((column) => ({ label: column, value: column }))"
              :model-value="readString('categoryField')"
              @update:model-value="updateConfig({ categoryField: String($event || '') })"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Category label rotation
            <USelect
              v-bind="sharedSelectProps"
              class="mt-1"
              :items="SCATTER_LABEL_ROTATION_OPTIONS"
              :model-value="scatterCategoryLabelRotation"
              @update:model-value="setScatterCategoryLabelRotation($event)"
            />
          </label>
        </div>

        <div v-if="scatterMode === 'category_compare'" class="mt-3">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Series fields</p>
          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <label
              v-for="field in scatterSeriesCandidateFields"
              :key="`scatter-series-${field}`"
              class="inline-flex items-center gap-2 text-xs text-gray-700"
            >
              <input
                :checked="scatterCompareSeries.some((entry) => entry.field === field)"
                type="checkbox"
                class="h-4 w-4 rounded border border-gray-300"
                @change="toggleScatterSeriesField(field, ($event.target as HTMLInputElement).checked)"
              >
              <span class="truncate">{{ field }}</span>
            </label>
          </div>
        </div>

        <div v-if="scatterMode === 'category_compare' && scatterCompareSeries.length" class="mt-3 space-y-2">
          <div
            v-for="(series, index) in scatterCompareSeries"
            :key="`scatter-series-options-${series.field}`"
            class="space-y-2 rounded border border-gray-200 bg-gray-50 p-2"
          >
            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Label
              <UInput
                class="mt-1"
                :model-value="series.label ?? series.field"
                @update:model-value="updateScatterSeries(index, { label: String($event || '') })"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Color
              <input
                :value="series.color ?? '#2563eb'"
                type="color"
                class="mt-1 h-8 w-full cursor-pointer rounded border border-gray-300 bg-white px-1"
                @input="updateScatterSeries(index, { color: ($event.target as HTMLInputElement).value })"
              >
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Bubble size field
              <USelect
                v-bind="sharedSelectProps"
                class="mt-1"
                :items="numericColumns.map((column) => ({ label: column, value: column }))"
                :model-value="series.sizeField ?? series.field"
                @update:model-value="updateScatterSeries(index, { sizeField: String($event || series.field) })"
              />
            </label>
          </div>
        </div>

        <div class="mt-3 space-y-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Min bubble size
            <UInput
              class="mt-1"
              type="number"
              :model-value="String(readNumber('minSymbolSize', 10))"
              @update:model-value="updateInteger('minSymbolSize', $event, 10)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Max bubble size
            <UInput
              class="mt-1"
              type="number"
              :model-value="String(readNumber('maxSymbolSize', 42))"
              @update:model-value="updateInteger('maxSymbolSize', $event, 42)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Y-axis min
            <UInput
              class="mt-1"
              type="number"
              :model-value="readOptionalNumericText('yAxisMin')"
              @update:model-value="updateOptionalNumber('yAxisMin', $event)"
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Y-axis max
            <UInput
              class="mt-1"
              type="number"
              :model-value="readOptionalNumericText('yAxisMax')"
              @update:model-value="updateOptionalNumber('yAxisMax', $event)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            Invert Y-axis
            <USwitch :model-value="readBoolean('yAxisInverse', false)" @update:model-value="updateBoolean('yAxisInverse', $event)" />
          </label>
        </div>
      </template>
    </div>
  </section>
</template>
