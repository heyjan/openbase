<script setup lang="ts">
import { Table2, TrendingUp, AreaChart, BarChart3, PieChart, ScatterChart } from 'lucide-vue-next'
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import Table from '~/components/ui/Table.vue'
import type { SavedQueryPreviewResult } from '~/types/query'
import type { QueryPreviewVisualization, VizSeriesOption } from '~/types/viz-options'
import {
  applyTableSortAndLimit,
  formatTableCellDisplayValue,
  getCategoryColumns,
  getColumnNumericExtents,
  getConditionalCellStyle,
  getNumericColumns,
  parseConditionalFormattingRules,
  resolveTableColumnOrder,
  resolveTableColumnValueFormats,
  resolveTableVisibleColumns,
  toNumber
} from '~/composables/useVizConfig'

type VisualizationOption = {
  id: QueryPreviewVisualization
  label: string
  description: string
  icon: ReturnType<typeof defineComponent>
}

const props = withDefaults(
  defineProps<{
    result: SavedQueryPreviewResult
    visualization: QueryPreviewVisualization
    showVisualizationMenu: boolean
    vizConfig?: Record<string, unknown>
  }>(),
  {
    vizConfig: () => ({})
  }
)

const emit = defineEmits<{
  (event: 'update:visualization', value: QueryPreviewVisualization): void
}>()

const visualizationOptions: VisualizationOption[] = [
  {
    id: 'table',
    label: 'Table',
    description: 'Raw rows and columns',
    icon: Table2
  },
  {
    id: 'line',
    label: 'Line Chart',
    description: 'Trend over category axis',
    icon: TrendingUp
  },
  {
    id: 'area',
    label: 'Area Chart',
    description: 'Line chart with filled area',
    icon: AreaChart
  },
  {
    id: 'bar',
    label: 'Bar Chart',
    description: 'Compare values by category',
    icon: BarChart3
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    description: 'Distribution by category',
    icon: PieChart
  },
  {
    id: 'scatter',
    label: 'Scatter',
    description: 'Relationship between numeric fields',
    icon: ScatterChart
  }
]

const palette = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']
const rows = computed(() => props.result.rows ?? [])
const columns = computed(() => props.result.columns ?? [])
const activeVisualizationLabel = computed(
  () => visualizationOptions.find((item) => item.id === props.visualization)?.label ?? 'Table'
)

const config = computed(() => props.vizConfig ?? {})

const readString = (keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

const readBoolean = (keys: string[], fallback: boolean) => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return fallback
}

const readNumber = (keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return fallback
}

const readOptionalNumber = (keys: string[]) => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

const numericColumns = computed(() => getNumericColumns(rows.value, columns.value))
const categoryColumns = computed(() => getCategoryColumns(columns.value, numericColumns.value))

const primaryCategoryColumn = computed(() => {
  const configured = readString(['xField', 'x_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? ''
})

const fallbackSeriesFields = computed(() => {
  const withoutCategory = numericColumns.value.filter((column) => column !== primaryCategoryColumn.value)
  return (withoutCategory.length ? withoutCategory : numericColumns.value).slice(0, 6)
})

const parseConfiguredSeries = (allowedFields: string[]) => {
  const raw = config.value.series
  if (!Array.isArray(raw)) {
    return [] as VizSeriesOption[]
  }

  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const field = typeof record.field === 'string' ? record.field.trim() : ''
      if (!field || !allowedFields.includes(field)) {
        return null
      }

      const label =
        typeof record.label === 'string' && record.label.trim() ? record.label.trim() : field
      const color =
        typeof record.color === 'string' && record.color.trim()
          ? record.color.trim()
          : palette[index % palette.length]

      return {
        field,
        label,
        color
      } satisfies VizSeriesOption
    })
    .filter((item): item is VizSeriesOption => item !== null)
}

const seriesConfig = computed(() => {
  const configured = parseConfiguredSeries(numericColumns.value)
  if (configured.length) {
    return configured
  }

  return fallbackSeriesFields.value.map((field, index) => ({
    field,
    label: field,
    color: palette[index % palette.length]
  }))
})

const categories = computed(() =>
  rows.value.map((row, index) => {
    if (!primaryCategoryColumn.value) {
      return String(index + 1)
    }
    return String(row[primaryCategoryColumn.value] ?? index + 1)
  })
)

const chartTitle = computed(() => readString(['titleOverride']))
const showLegend = computed(() => readBoolean(['showLegend', 'show_legend'], true))

const pieCategoryColumn = computed(() => {
  const configured = readString(['categoryField', 'category_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? columns.value[0] ?? ''
})

const pieValueColumn = computed(() => {
  const configured = readString(['valueField', 'value_field'])
  if (configured && numericColumns.value.includes(configured)) {
    return configured
  }

  return (
    numericColumns.value.find((column) => column !== pieCategoryColumn.value) ??
    numericColumns.value[0] ??
    ''
  )
})

const pieTopN = computed(() => {
  const topN = readNumber(['topN', 'top_n'], 8)
  return topN > 0 ? Math.trunc(topN) : 8
})

const pieData = computed(() => {
  if (!pieCategoryColumn.value || !pieValueColumn.value) {
    return [] as Array<{ name: string; value: number }>
  }

  const totals = new Map<string, number>()
  for (const row of rows.value) {
    const name = String(row[pieCategoryColumn.value] ?? '').trim() || 'Unknown'
    const value = toNumber(row[pieValueColumn.value])
    if (value === null) {
      continue
    }
    totals.set(name, (totals.get(name) ?? 0) + value)
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, pieTopN.value)
})

const hasPieData = computed(() => pieData.value.length > 0)
const pieDonut = computed(() => readBoolean(['donut'], true))
const pieShowLabels = computed(() => readBoolean(['showLabels', 'show_labels'], false))

const scatterXColumn = computed(() => {
  const configured = readString(['xField', 'x_field'])
  if (configured && numericColumns.value.includes(configured)) {
    return configured
  }
  return numericColumns.value[0] ?? ''
})

const scatterYColumn = computed(() => {
  const configured = readString(['yField', 'y_field'])
  if (configured && numericColumns.value.includes(configured)) {
    return configured
  }
  return numericColumns.value.find((column) => column !== scatterXColumn.value) ?? ''
})

const scatterSizeColumn = computed(() => {
  const configured = readString(['sizeField', 'size_field'])
  if (configured && numericColumns.value.includes(configured)) {
    return configured
  }

  return (
    numericColumns.value.find(
      (column) => column !== scatterXColumn.value && column !== scatterYColumn.value
    ) ?? scatterYColumn.value
  )
})

const scatterLabelColumn = computed(() => {
  const configured = readString(['labelField', 'label_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? ''
})

const scatterData = computed(() => {
  if (!scatterXColumn.value || !scatterYColumn.value) {
    return [] as Array<{ value: [number, number, number]; name?: string }>
  }

  return rows.value
    .map((row) => {
      const x = toNumber(row[scatterXColumn.value])
      const y = toNumber(row[scatterYColumn.value])
      const size =
        toNumber(row[scatterSizeColumn.value]) ??
        toNumber(row[scatterYColumn.value]) ??
        null

      if (x === null || y === null || size === null) {
        return null
      }

      const label =
        scatterLabelColumn.value &&
        row[scatterLabelColumn.value] !== null &&
        row[scatterLabelColumn.value] !== undefined
          ? String(row[scatterLabelColumn.value]).trim()
          : ''

      return {
        value: [x, y, size] as [number, number, number],
        name: label || undefined
      }
    })
    .filter((entry): entry is { value: [number, number, number]; name?: string } => entry !== null)
})

const scatterSizeExtent = computed(() => {
  const sizes = scatterData.value.map((item) => item.value[2])
  if (!sizes.length) {
    return { min: 0, max: 0 }
  }
  return {
    min: Math.min(...sizes),
    max: Math.max(...sizes)
  }
})

const scatterMinSymbolSize = computed(() => readNumber(['minSymbolSize', 'min_symbol_size'], 10))
const scatterMaxSymbolSize = computed(() => readNumber(['maxSymbolSize', 'max_symbol_size'], 42))
const scatterShowLabels = computed(() => readBoolean(['showLabels', 'show_labels'], false))

const scaleScatterSymbolSize = (value: unknown) => {
  if (!Array.isArray(value)) {
    return scatterMinSymbolSize.value
  }

  const rawSize = Number(value[2])
  if (!Number.isFinite(rawSize)) {
    return scatterMinSymbolSize.value
  }

  const span = scatterSizeExtent.value.max - scatterSizeExtent.value.min
  if (span <= 0) {
    return (scatterMinSymbolSize.value + scatterMaxSymbolSize.value) / 2
  }

  const ratio = (rawSize - scatterSizeExtent.value.min) / span
  const clamped = Math.max(0, Math.min(1, ratio))
  const min = Math.min(scatterMinSymbolSize.value, scatterMaxSymbolSize.value)
  const max = Math.max(scatterMinSymbolSize.value, scatterMaxSymbolSize.value)

  return min + clamped * (max - min)
}

const hasScatterData = computed(() => scatterData.value.length > 0)

const hasCartesianData = computed(() => rows.value.length > 0 && seriesConfig.value.length > 0)
const smoothLines = computed(() => readBoolean(['smooth'], true))
const showSymbols = computed(() => readBoolean(['showSymbols', 'show_symbols'], false))
const showArea = computed(() =>
  props.visualization === 'area' ? readBoolean(['area'], true) : false
)
const yAxisMin = computed(() => readOptionalNumber(['yAxisMin', 'y_axis_min']))
const yAxisMax = computed(() => readOptionalNumber(['yAxisMax', 'y_axis_max']))

const barHorizontal = computed(() => readBoolean(['horizontal'], false))
const barStacked = computed(() => readBoolean(['stacked'], false))
const barBorderRadius = computed(() => {
  const radius = readNumber(['barBorderRadius', 'bar_border_radius'], 4)
  if (radius < 0) {
    return 0
  }
  return radius > 12 ? 12 : radius
})

const tableOrderedColumns = computed(() =>
  resolveTableColumnOrder(columns.value, config.value)
)

const tableVisibleColumns = computed(() =>
  resolveTableVisibleColumns(tableOrderedColumns.value, config.value)
)

const tableShowSearch = computed(() =>
  readBoolean(['showSearch', 'show_search'], false)
)

const tableSearchQuery = ref('')

const tableRows = computed(() => applyTableSortAndLimit(rows.value, config.value))

const normalizeTableValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const filteredTableRows = computed(() => {
  if (!tableShowSearch.value) {
    return tableRows.value
  }

  const query = tableSearchQuery.value.trim().toLowerCase()
  if (!query) {
    return tableRows.value
  }

  return tableRows.value.filter((row) =>
    tableVisibleColumns.value.some((column) =>
      normalizeTableValue(row[column]).toLowerCase().includes(query)
    )
  )
})

const tableColumns = computed(() =>
  tableVisibleColumns.value.map((column) => ({
    key: column,
    label: column
  }))
)

const tableColumnValueFormats = computed(() =>
  resolveTableColumnValueFormats(tableVisibleColumns.value, config.value)
)

const tableConditionalRules = computed(() =>
  parseConditionalFormattingRules(config.value.conditionalFormatting)
)

const tableColumnExtents = computed(() =>
  getColumnNumericExtents(filteredTableRows.value, tableVisibleColumns.value)
)

const tableCellStyleResolver = (input: { columnKey: string; value: unknown }) =>
  getConditionalCellStyle({
    columnKey: input.columnKey,
    value: input.value,
    rules: tableConditionalRules.value,
    columnExtents: tableColumnExtents.value
  })

const tableCellValueFormatter = (input: { columnKey: string; defaultValue: string }) =>
  formatTableCellDisplayValue(
    input.defaultValue,
    input.columnKey,
    tableColumnValueFormats.value
  )

const chartRenderKey = computed(
  () => `${props.visualization}:${JSON.stringify(config.value)}:${rows.value.length}`
)

watch(tableShowSearch, (enabled) => {
  if (!enabled) {
    tableSearchQuery.value = ''
  }
})

const chartOption = computed<EChartsOption>(() => {
  if (props.visualization === 'pie') {
    return {
      title: chartTitle.value
        ? {
            text: chartTitle.value,
            left: 'center',
            top: 0,
            textStyle: {
              color: '#111827',
              fontSize: 14,
              fontWeight: 600
            }
          }
        : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        show: showLegend.value,
        bottom: 0,
        type: 'scroll',
        textStyle: { color: '#4b5563' }
      },
      series: [
        {
          type: 'pie',
          radius: pieDonut.value ? ['35%', '70%'] : ['0%', '72%'],
          center: ['50%', '44%'],
          data: pieData.value,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2
          },
          label: {
            show: pieShowLabels.value,
            color: '#374151'
          }
        }
      ]
    }
  }

  if (props.visualization === 'scatter') {
    return {
      title: chartTitle.value
        ? {
            text: chartTitle.value,
            left: 'center',
            top: 0,
            textStyle: {
              color: '#111827',
              fontSize: 14,
              fontWeight: 600
            }
          }
        : undefined,
      tooltip: {
        trigger: 'item'
      },
      grid: {
        left: 12,
        right: 12,
        top: chartTitle.value ? 48 : 18,
        bottom: 28,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: scatterXColumn.value || 'X',
        nameGap: 20,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      yAxis: {
        type: 'value',
        name: scatterYColumn.value || 'Y',
        nameGap: 30,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: [
        {
          type: 'scatter',
          data: scatterData.value,
          symbolSize: scaleScatterSymbolSize,
          itemStyle: {
            color: '#2563eb',
            opacity: 0.78
          },
          label: {
            show: scatterShowLabels.value,
            position: 'top',
            color: '#374151',
            formatter: (params: { data?: { name?: string } }) => params.data?.name ?? ''
          },
          emphasis: {
            focus: 'series'
          }
        }
      ]
    }
  }

  const isBar = props.visualization === 'bar'

  return {
    title: chartTitle.value
      ? {
          text: chartTitle.value,
          left: 'center',
          top: 0,
          textStyle: {
            color: '#111827',
            fontSize: 14,
            fontWeight: 600
          }
        }
      : undefined,
    color: seriesConfig.value.map((series) => series.color ?? '#2563eb'),
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: isBar ? 'shadow' : 'line'
      }
    },
    legend: {
      show: showLegend.value,
      top: chartTitle.value ? 22 : 0,
      textStyle: {
        color: '#4b5563'
      }
    },
    grid: {
      left: 12,
      right: 12,
      top: chartTitle.value ? 62 : 40,
      bottom: 28,
      containLabel: true
    },
    xAxis: isBar && barHorizontal.value
      ? {
          type: 'value',
          axisLabel: {
            color: '#6b7280'
          },
          min: yAxisMin.value,
          max: yAxisMax.value,
          splitLine: {
            lineStyle: { color: '#e5e7eb' }
          }
        }
      : {
          type: 'category',
          data: categories.value,
          axisLabel: {
            color: '#6b7280'
          },
          axisLine: {
            lineStyle: { color: '#d1d5db' }
          }
        },
    yAxis: isBar && barHorizontal.value
      ? {
          type: 'category',
          data: categories.value,
          axisLabel: {
            color: '#6b7280'
          },
          axisLine: {
            lineStyle: { color: '#d1d5db' }
          }
        }
      : {
          type: 'value',
          min: yAxisMin.value,
          max: yAxisMax.value,
          axisLabel: {
            color: '#6b7280'
          },
          splitLine: {
            lineStyle: { color: '#e5e7eb' }
          }
        },
    series: seriesConfig.value.map((series) => ({
      type: isBar ? 'bar' : 'line',
      name: series.label ?? series.field,
      smooth: !isBar ? smoothLines.value : undefined,
      showSymbol: !isBar ? showSymbols.value : undefined,
      areaStyle: !isBar && showArea.value ? { opacity: 0.18 } : undefined,
      stack: isBar && barStacked.value ? 'total' : undefined,
      emphasis: {
        focus: 'series'
      },
      itemStyle: {
        color: series.color ?? '#2563eb',
        borderRadius: isBar ? barBorderRadius.value : 0
      },
      data: rows.value.map((row) => toNumber(row[series.field]))
    }))
  }
})
</script>

<template>
  <div class="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
    <div class="flex items-center justify-between text-xs text-gray-500">
      <p>Rows: {{ result.rowCount }} | Columns: {{ result.columns.length }}</p>
      <p class="uppercase tracking-wide text-gray-400">{{ activeVisualizationLabel }}</p>
    </div>

    <div class="mt-3 flex gap-3">
      <aside
        v-if="showVisualizationMenu"
        class="w-56 shrink-0 rounded border border-gray-200 bg-white p-3"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Visualizations
        </p>
        <div class="mt-2 grid gap-1">
          <UButton
            v-for="option in visualizationOptions"
            :key="option.id"
            color="neutral"
            :variant="visualization === option.id ? 'solid' : 'ghost'"
            size="xs"
            class="justify-start text-left"
            :title="option.description"
            @click="emit('update:visualization', option.id)"
          >
            <div class="flex items-center gap-2">
              <component :is="option.icon" class="h-4 w-4 shrink-0" />
              <span class="text-xs font-medium">{{ option.label }}</span>
            </div>
          </UButton>
        </div>
      </aside>

      <div class="min-w-0 flex-1 rounded border border-gray-200 bg-white">
        <div v-if="visualization === 'table'" class="overflow-auto">
          <div v-if="tableShowSearch" class="border-b border-gray-200 p-3">
            <UInput
              v-model="tableSearchQuery"
              placeholder="Search rows"
              class="w-full max-w-xs"
            />
          </div>
          <Table
            :rows="filteredTableRows"
            :columns="tableColumns"
            :cell-style-resolver="tableCellStyleResolver"
            :cell-value-formatter="tableCellValueFormatter"
            empty-label="No preview rows found."
          />
        </div>

        <div v-else class="p-3">
          <p
            v-if="visualization === 'pie'"
            class="mb-2 text-xs text-gray-500"
          >
            Grouping by <span class="font-medium text-gray-700">{{ pieCategoryColumn || 'category' }}</span>
            using <span class="font-medium text-gray-700">{{ pieValueColumn || 'value' }}</span>.
          </p>
          <p
            v-else-if="visualization === 'scatter'"
            class="mb-2 text-xs text-gray-500"
          >
            X: <span class="font-medium text-gray-700">{{ scatterXColumn || 'none' }}</span>
            | Y: <span class="font-medium text-gray-700">{{ scatterYColumn || 'none' }}</span>
            | Size: <span class="font-medium text-gray-700">{{ scatterSizeColumn || 'none' }}</span>
          </p>
          <p
            v-else
            class="mb-2 text-xs text-gray-500"
          >
            X-axis: <span class="font-medium text-gray-700">{{ primaryCategoryColumn || 'row index' }}</span>
            | Series:
            <span class="font-medium text-gray-700">
              {{ seriesConfig.map((series) => series.label || series.field).join(', ') || 'none' }}
            </span>
          </p>

          <p
            v-if="visualization === 'pie' && !hasPieData"
            class="text-sm text-gray-500"
          >
            No suitable category/value columns found for pie chart rendering.
          </p>
          <p
            v-else-if="visualization === 'scatter' && !hasScatterData"
            class="text-sm text-gray-500"
          >
            Need at least two numeric columns to render a scatter chart.
          </p>
          <p
            v-else-if="visualization !== 'pie' && visualization !== 'scatter' && !hasCartesianData"
            class="text-sm text-gray-500"
          >
            No numeric series columns found for chart rendering.
          </p>
          <EChart
            v-else
            :key="chartRenderKey"
            :option="chartOption"
            height="320px"
          />
        </div>
      </div>
    </div>
  </div>
</template>
