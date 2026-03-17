<script setup lang="ts">
import {
  Table2,
  TrendingUp,
  AreaChart,
  BarChart3,
  ChartBarStacked,
  ChartNoAxesColumnIncreasing,
  PieChart,
  Radar,
  ScatterChart
} from 'lucide-vue-next'
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import Table from '~/components/ui/Table.vue'
import type { SavedQueryPreviewResult } from '~/types/query'
import type {
  QueryPreviewVisualization,
  ScatterCompareSeriesOption,
  ScatterVizMode,
  VizSeriesOption
} from '~/types/viz-options'
import {
  applyTableSortAndLimit,
  detectTableTabGroups,
  formatTableCellDisplayValue,
  getCategoryColumns,
  getColumnGradientStyle,
  getColumnNumericExtents,
  getConditionalCellStyle,
  getNumericColumns,
  parseConditionalFormattingRules,
  resolveColumnColors,
  resolveColumnGradients,
  resolveTableColumnOrder,
  resolveTableColumnValueFormats,
  resolveTableTabDefault,
  resolveTableTabGroupSeparator,
  resolveTableTabSharedColumns,
  resolveTableTabbedEnabled,
  resolveTableVisibleColumns,
  stripTableTabGroupPrefix,
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
    id: 'kpi',
    label: 'KPI Card',
    description: 'Single value with label',
    icon: TrendingUp
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
    id: 'stacked_horizontal_bar',
    label: 'Stacked Horizontal Bar',
    description: 'Stacked comparison across horizontal categories',
    icon: ChartBarStacked
  },
  {
    id: 'waterfall',
    label: 'Waterfall Chart',
    description: 'Running contribution analysis with totals',
    icon: ChartNoAxesColumnIncreasing
  },
  {
    id: 'radar',
    label: 'Radar Chart',
    description: 'Multi-metric profile across categories',
    icon: Radar
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
const KPI_VALUE_FORMATTER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const readString = (keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

const readText = (keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = config.value[key]
    if (typeof value === 'string') {
      return value
    }
  }
  return fallback
}

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim()
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null
  }
  if (trimmed.length === 4) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return trimmed
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
const kpiValueField = computed(() => {
  const configured = readString(['valueField', 'value_field', 'metricField', 'metric_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return numericColumns.value[0] ?? columns.value[0] ?? ''
})
const kpiLabel = computed(() => readString(['label']) || chartTitle.value || kpiValueField.value || 'KPI')
const kpiPrefix = computed(() => readText(['prefix', 'valuePrefix', 'value_prefix']))
const kpiPostfix = computed(() => readText(['postfix', 'suffix', 'valuePostfix', 'value_postfix']))
const kpiValueColor = computed(
  () =>
    normalizeHexColor(readText(['valueColor', 'value_color', 'textColor', 'text_color'])) ??
    '#111827'
)
const kpiRawValue = computed(() => {
  if (!kpiValueField.value || !rows.value.length) {
    return null
  }
  return rows.value[0]?.[kpiValueField.value]
})
const kpiDisplayValue = computed(() => {
  const raw = kpiRawValue.value
  if (raw === null || raw === undefined || raw === '') {
    return 'No data'
  }
  const numeric = toNumber(raw)
  if (numeric !== null) {
    return `${kpiPrefix.value}${KPI_VALUE_FORMATTER.format(numeric)}${kpiPostfix.value}`
  }
  return `${kpiPrefix.value}${String(raw)}${kpiPostfix.value}`
})

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
const scatterMode = computed<ScatterVizMode>(() =>
  readString(['mode', 'scatterMode', 'scatter_mode']) === 'category_compare'
    ? 'category_compare'
    : 'numeric'
)

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

const scatterNumericData = computed(() => {
  if (!scatterXColumn.value || !scatterYColumn.value) {
    return [] as Array<{ value: [number, number, number]; rawValue: [unknown, unknown, unknown]; name?: string }>
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
        rawValue: [row[scatterXColumn.value], row[scatterYColumn.value], row[scatterSizeColumn.value]],
        name: label || undefined
      }
    })
    .filter((entry): entry is { value: [number, number, number]; rawValue: [unknown, unknown, unknown]; name?: string } => entry !== null)
})

const scatterCategoryColumn = computed(() => {
  const configured = readString(['categoryField', 'category_field', 'xField', 'x_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? columns.value[0] ?? ''
})
const scatterSellerColumns = computed(() =>
  columns.value.filter((column) => /(händler|haendler|seller)/i.test(column))
)

const normalizeScatterFieldForSeller = (value: string) =>
  value
    .toLowerCase()
    .replace(/(händler|haendler|seller|preis|price)/g, '')
    .replace(/[^a-z0-9]/g, '')

const resolveScatterSellerFieldForSeries = (series: ScatterCompareSeriesOption) => {
  if (!scatterSellerColumns.value.length) {
    return ''
  }

  const label = (series.label ?? series.field).trim()
  const directCandidates = [
    series.field.replace(/preis/gi, 'Händler'),
    series.field.replace(/price/gi, 'Seller'),
    label.replace(/preis/gi, 'Händler'),
    label.replace(/price/gi, 'Seller')
  ]

  for (const candidate of directCandidates) {
    const match = scatterSellerColumns.value.find(
      (column) => column.toLowerCase() === candidate.toLowerCase()
    )
    if (match) {
      return match
    }
  }

  const rankMatch = `${series.field} ${label}`.match(/(?:rang|rank)\s*(\d+)/i)
  if (rankMatch) {
    const rank = rankMatch[1]
    const match = scatterSellerColumns.value.find((column) =>
      new RegExp(`(?:rang|rank)\\s*${rank}\\b`, 'i').test(column)
    )
    if (match) {
      return match
    }
  }

  const base = normalizeScatterFieldForSeller(label || series.field)
  if (base) {
    const match = scatterSellerColumns.value.find(
      (column) => normalizeScatterFieldForSeller(column) === base
    )
    if (match) {
      return match
    }
  }

  return ''
}

const getScatterSellerLabelForSeries = (seriesLabel: string) => {
  if (/price/i.test(seriesLabel)) {
    return seriesLabel.replace(/price/gi, 'Seller')
  }
  if (/preis/i.test(seriesLabel)) {
    return seriesLabel.replace(/preis/gi, 'Händler')
  }
  return `${seriesLabel} Händler`
}

const scatterCompareSeries = computed<ScatterCompareSeriesOption[]>(() => {
  const raw = config.value.series
  if (!Array.isArray(raw)) {
    return numericColumns.value.slice(0, 2).map((field, index) => ({
      field,
      label: field,
      color: palette[(index + 1) % palette.length],
      sizeField: field
    }))
  }

  const parsed = raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const field = typeof record.field === 'string' ? record.field.trim() : ''
      if (!field || !numericColumns.value.includes(field)) {
        return null
      }

      const label =
        typeof record.label === 'string' && record.label.trim() ? record.label.trim() : field
      const color =
        typeof record.color === 'string' && record.color.trim()
          ? record.color.trim()
          : palette[index % palette.length]
      const sizeField =
        typeof record.sizeField === 'string' &&
        record.sizeField.trim() &&
        numericColumns.value.includes(record.sizeField.trim())
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

  if (parsed.length) {
    return parsed
  }

  return numericColumns.value.slice(0, 2).map((field, index) => ({
    field,
    label: field,
    color: palette[(index + 1) % palette.length],
    sizeField: field
  }))
})

const scatterCategories = computed(() => {
  if (!scatterCategoryColumn.value) {
    return [] as string[]
  }

  const values: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < rows.value.length; index += 1) {
    const row = rows.value[index]
    const category = String(row[scatterCategoryColumn.value] ?? `Item ${index + 1}`).trim() || `Item ${index + 1}`
    if (seen.has(category)) {
      continue
    }
    seen.add(category)
    values.push(category)
  }
  return values
})

const scatterCompareSeriesData = computed(() =>
  scatterCompareSeries.value
    .map((series) => {
      const sellerField = resolveScatterSellerFieldForSeries(series)
      return {
        ...series,
        sellerField,
        points: rows.value
        .map((row, rowIndex) => {
          const category = String(row[scatterCategoryColumn.value] ?? `Item ${rowIndex + 1}`).trim() || `Item ${rowIndex + 1}`
          const y = toNumber(row[series.field])
          const size = toNumber(row[series.sizeField ?? series.field]) ?? y

          if (y === null || size === null) {
            return null
          }

          return {
            value: [category, y, size] as [string, number, number],
            rawValue: [row[scatterCategoryColumn.value], row[series.field], row[series.sizeField ?? series.field]],
            name: category,
            sizeField: series.sizeField ?? series.field,
            sellerField: sellerField || undefined,
            sellerValue: sellerField ? row[sellerField] : undefined,
            seriesField: series.field,
            seriesLabel: series.label ?? series.field
          }
        })
        .filter(
          (point): point is {
            value: [string, number, number]
            rawValue: [unknown, unknown, unknown]
            name: string
            sizeField: string
            sellerField?: string
            sellerValue?: unknown
            seriesField: string
            seriesLabel: string
          } => point !== null
        )
      }
    })
    .filter((series) => series.points.length > 0)
)

const scatterSizeExtent = computed(() => {
  const sizes =
    scatterMode.value === 'category_compare'
      ? scatterCompareSeriesData.value.flatMap((series) => series.points.map((point) => point.value[2]))
      : scatterNumericData.value.map((item) => item.value[2])
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
const scatterCategoryLabelRotation = computed(() => {
  const rawValue = readNumber(
    [
      'categoryLabelRotation',
      'category_label_rotation',
      'xAxisLabelRotation',
      'x_axis_label_rotation',
      'axisLabelRotate',
      'axis_label_rotate'
    ],
    0
  )
  return rawValue === 45 || rawValue === 90 ? rawValue : 0
})
const scatterYAxisInverse = computed(() => readBoolean(['yAxisInverse', 'y_axis_inverse'], false))
const scatterLegendVisible = computed(
  () => scatterMode.value === 'category_compare' && scatterCompareSeriesData.value.length > 1
)
const scatterCategoryAxisLabel = computed(() => ({
  color: '#6b7280',
  rotate: scatterCategoryLabelRotation.value,
  interval: scatterCategoryLabelRotation.value > 0 ? 0 : undefined,
  hideOverlap: scatterCategoryLabelRotation.value > 0 ? false : undefined
}))

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

const hasScatterData = computed(() =>
  scatterMode.value === 'category_compare'
    ? scatterCompareSeriesData.value.length > 0
    : scatterNumericData.value.length > 0
)

const hasCartesianData = computed(() => rows.value.length > 0 && seriesConfig.value.length > 0)
const smoothLines = computed(() => readBoolean(['smooth'], true))
const showSymbols = computed(() => readBoolean(['showSymbols', 'show_symbols'], false))
const showArea = computed(() =>
  props.visualization === 'area' ? readBoolean(['area'], true) : false
)
const yAxisMin = computed(() => readOptionalNumber(['yAxisMin', 'y_axis_min']))
const yAxisMax = computed(() => readOptionalNumber(['yAxisMax', 'y_axis_max']))

const isBarVisualization = computed(
  () => props.visualization === 'bar' || props.visualization === 'stacked_horizontal_bar'
)

const barHorizontal = computed(() =>
  props.visualization === 'stacked_horizontal_bar'
    ? true
    : readBoolean(['horizontal'], false)
)
const barStacked = computed(() =>
  props.visualization === 'stacked_horizontal_bar'
    ? true
    : readBoolean(['stacked'], false)
)
const barBorderRadius = computed(() => {
  const radius = readNumber(['barBorderRadius', 'bar_border_radius'], 4)
  if (radius < 0) {
    return 0
  }
  return radius > 12 ? 12 : radius
})

const waterfallCategoryColumn = computed(() => {
  const configured = readString(['categoryField', 'category_field', 'xField', 'x_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? columns.value[0] ?? ''
})

const waterfallValueColumn = computed(() => {
  const configured = readString(['valueField', 'value_field'])
  if (configured && numericColumns.value.includes(configured)) {
    return configured
  }
  return (
    numericColumns.value.find((column) => column !== waterfallCategoryColumn.value) ??
    numericColumns.value[0] ??
    ''
  )
})

const waterfallPositiveColor = computed(() =>
  readString(['positiveColor', 'positive_color'], '#16a34a')
)
const waterfallNegativeColor = computed(() =>
  readString(['negativeColor', 'negative_color'], '#dc2626')
)
const waterfallTotalColor = computed(() =>
  readString(['totalColor', 'total_color'], '#2563eb')
)
const waterfallShowLegend = computed(() => readBoolean(['showLegend', 'show_legend'], false))

type WaterfallPoint = {
  label: string
  delta: number
}

const waterfallPoints = computed<WaterfallPoint[]>(() => {
  if (!waterfallCategoryColumn.value || !waterfallValueColumn.value) {
    return []
  }

  return rows.value
    .map((row, index) => {
      const label = String(row[waterfallCategoryColumn.value] ?? '').trim() || `Item ${index + 1}`
      const delta = toNumber(row[waterfallValueColumn.value])
      if (delta === null) {
        return null
      }
      return { label, delta } satisfies WaterfallPoint
    })
    .filter((point): point is WaterfallPoint => point !== null)
})

const waterfallBreakdown = computed(() => {
  let runningTotal = 0
  const bars = waterfallPoints.value.map((point) => {
    const start = runningTotal
    runningTotal += point.delta
    return {
      ...point,
      start,
      totalAfter: runningTotal
    }
  })

  return {
    bars,
    total: runningTotal
  }
})

const waterfallCategories = computed(() => [
  ...waterfallBreakdown.value.bars.map((item) => item.label),
  'Total'
])
const waterfallBaseSeries = computed(() => [
  ...waterfallBreakdown.value.bars.map((item) => item.start),
  0
])
const waterfallDeltaSeries = computed(() => [
  ...waterfallBreakdown.value.bars.map((item) => item.delta),
  waterfallBreakdown.value.total
])
const hasWaterfallData = computed(() => waterfallBreakdown.value.bars.length > 0)

const radarCategoryColumn = computed(() => {
  const configured = readString(['xField', 'x_field'])
  if (configured && columns.value.includes(configured)) {
    return configured
  }
  return categoryColumns.value[0] ?? ''
})

const radarCategories = computed(() =>
  rows.value.map((row, index) =>
    String(
      radarCategoryColumn.value
        ? (row[radarCategoryColumn.value] ?? index + 1)
        : index + 1
    )
  )
)

const radarIndicatorValues = computed(() =>
  radarCategories.value.map((name, index) => {
    const values = seriesConfig.value
      .map((series) => toNumber(rows.value[index]?.[series.field]))
      .filter((value): value is number => value !== null)
    const maxValue = values.length ? Math.max(...values) : 0
    const scaleMax = maxValue > 0 ? maxValue * 1.2 : 1

    return {
      name,
      max: scaleMax
    }
  })
)

const radarSeriesData = computed(() =>
  seriesConfig.value.map((series) => ({
    name: series.label ?? series.field,
    value: rows.value.map((row) => toNumber(row[series.field]) ?? 0)
  }))
)

const hasRadarData = computed(
  () => radarIndicatorValues.value.length > 2 && radarSeriesData.value.length > 0
)

const tableOrderedColumns = computed(() =>
  resolveTableColumnOrder(columns.value, config.value)
)

const tableVisibleColumns = computed(() =>
  resolveTableVisibleColumns(tableOrderedColumns.value, config.value)
)

const tableTabbedEnabled = computed(() =>
  resolveTableTabbedEnabled(config.value)
)

const tableTabGroupSeparator = computed(() =>
  resolveTableTabGroupSeparator(config.value)
)

const tableTabSharedColumns = computed(() =>
  resolveTableTabSharedColumns(tableVisibleColumns.value, config.value)
)

const tableTabDefault = computed(() =>
  resolveTableTabDefault(config.value)
)

const tableTabGrouping = computed(() =>
  detectTableTabGroups(
    tableVisibleColumns.value,
    tableTabGroupSeparator.value,
    tableTabSharedColumns.value
  )
)

const tableTabGroups = computed(() =>
  [...tableTabGrouping.value.groups.entries()].map(([name, columns]) => ({
    name,
    columns
  }))
)

const tableSharedColumns = computed(() => tableTabGrouping.value.shared)
const tableShouldUseTabs = computed(() =>
  tableTabbedEnabled.value && tableTabGroups.value.length > 0
)
const tableShowTabBar = computed(() =>
  tableShouldUseTabs.value && tableTabGroups.value.length > 1
)

const tableActiveTab = ref('')

const tableShowSearch = computed(() =>
  readBoolean(['showSearch', 'show_search'], false)
)

const tableUseThousandsSeparator = computed(() =>
  readBoolean(['useThousandsSeparator', 'use_thousands_separator'], false)
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

watch(
  [tableTabGroups, tableTabDefault],
  ([groups, defaultTab]) => {
    if (!groups.length) {
      tableActiveTab.value = ''
      return
    }

    if (defaultTab && groups.some((group) => group.name === defaultTab)) {
      tableActiveTab.value = defaultTab
      return
    }

    if (groups.some((group) => group.name === tableActiveTab.value)) {
      return
    }

    tableActiveTab.value = groups[0]?.name ?? ''
  },
  { immediate: true }
)

const tableActiveTabGroup = computed(() => {
  if (!tableTabGroups.value.length) {
    return null
  }
  return (
    tableTabGroups.value.find((group) => group.name === tableActiveTab.value) ??
    tableTabGroups.value[0]
  )
})

const tableActiveTabGroupColumns = computed(() =>
  new Set(tableActiveTabGroup.value?.columns ?? [])
)

const tableActiveColumns = computed(() => {
  if (!tableShouldUseTabs.value) {
    return tableVisibleColumns.value
  }

  const selected = new Set([
    ...tableSharedColumns.value,
    ...(tableActiveTabGroup.value?.columns ?? [])
  ])
  return tableVisibleColumns.value.filter((column) => selected.has(column))
})

const tableColumns = computed(() =>
  tableActiveColumns.value.map((column) => ({
    key: column,
    label:
      tableShouldUseTabs.value && tableActiveTabGroupColumns.value.has(column)
        ? stripTableTabGroupPrefix(
            column,
            tableActiveTabGroup.value?.name ?? '',
            tableTabGroupSeparator.value
          )
        : column
  }))
)

const tableColumnValueFormats = computed(() =>
  resolveTableColumnValueFormats(tableVisibleColumns.value, config.value)
)

const tableColumnColors = computed(() =>
  resolveColumnColors(tableVisibleColumns.value, config.value)
)

const tableColumnGradients = computed(() =>
  resolveColumnGradients(tableVisibleColumns.value, config.value)
)

const tableConditionalRules = computed(() =>
  parseConditionalFormattingRules(config.value.conditionalFormatting)
)

const tableColumnExtents = computed(() =>
  getColumnNumericExtents(filteredTableRows.value, tableVisibleColumns.value)
)

const tableCellStyleResolver = (input: { columnKey: string; value: unknown }) => {
  const columnColor = tableColumnColors.value[input.columnKey]
  const gradientEnabled = tableColumnGradients.value[input.columnKey] === true
  const gradientStyle = gradientEnabled
    ? getColumnGradientStyle(
        input.columnKey,
        input.value,
        tableColumnExtents.value[input.columnKey],
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
    rules: tableConditionalRules.value,
    columnExtents: tableColumnExtents.value,
    baseStyle
  })
}

const tableCellValueFormatter = (input: { columnKey: string; defaultValue: string; value: unknown }) =>
  formatTableCellDisplayValue(
    input.defaultValue,
    input.columnKey,
    tableColumnValueFormats.value,
    input.value,
    tableUseThousandsSeparator.value
  )

const chartRenderKey = computed(
  () => `${props.visualization}:${JSON.stringify(config.value)}:${rows.value.length}`
)

watch(tableShowSearch, (enabled) => {
  if (!enabled) {
    tableSearchQuery.value = ''
  }
})

const formatScatterTooltipValue = (value: unknown) => {
  const numeric = toNumber(value)
  if (numeric !== null) {
    return KPI_VALUE_FORMATTER.format(numeric)
  }
  return String(value ?? '')
}

const formatScatterCategoryCompareTooltip = (params: unknown) => {
  const entries = Array.isArray(params) ? params : [params]
  const points = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const dataRecord =
        record.data && typeof record.data === 'object'
          ? (record.data as Record<string, unknown>)
          : null
      const values = Array.isArray(dataRecord?.value) ? dataRecord.value : []
      const rawValues = Array.isArray(dataRecord?.rawValue) ? dataRecord.rawValue : []
      const label =
        String(
          record.seriesName ??
            (typeof dataRecord?.seriesLabel === 'string' ? dataRecord.seriesLabel : '') ??
            (typeof dataRecord?.seriesField === 'string' ? dataRecord.seriesField : '')
        ) || 'Series'

      return {
        category: String(record.axisValueLabel ?? record.axisValue ?? dataRecord?.name ?? values[0] ?? ''),
        label,
        value: rawValues[1] ?? values[1],
        sellerField: typeof dataRecord?.sellerField === 'string' ? dataRecord.sellerField : undefined,
        sellerValue: dataRecord?.sellerValue,
        numericValue: toNumber(rawValues[1] ?? values[1])
      }
    })
    .filter(
      (
        point
      ): point is {
        category: string
        label: string
        value: unknown
        sellerField?: string
        sellerValue?: unknown
        numericValue: number | null
      } => point !== null
    )

  if (!points.length) {
    return ''
  }

  const rank1 = points.find((point) => /rang?\s*1/i.test(point.label))
  const rank2 = points.find((point) => /rang?\s*2/i.test(point.label))
  const fallbackFirst = points[0]
  const fallbackSecond = points[1]
  const diffBaseLeft = rank1 ?? fallbackFirst
  const diffBaseRight = rank2 ?? fallbackSecond
  const diff =
    diffBaseLeft?.numericValue !== null &&
    diffBaseLeft?.numericValue !== undefined &&
    diffBaseRight?.numericValue !== null &&
    diffBaseRight?.numericValue !== undefined
      ? diffBaseRight.numericValue - diffBaseLeft.numericValue
      : null

  return [
    points[0].category,
    ...points.flatMap((point) => {
      const rows = [`${point.label}: ${formatScatterTooltipValue(point.value)}`]
      const sellerText =
        point.sellerValue === null || point.sellerValue === undefined
          ? ''
          : String(point.sellerValue).trim()
      if (sellerText) {
        rows.push(`${getScatterSellerLabelForSeries(point.label)}: ${sellerText}`)
      }
      return rows
    }),
    ...(diff !== null ? [`Differenz €: ${formatScatterTooltipValue(diff)}`] : [])
  ].join('<br/>')
}

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
    if (scatterMode.value === 'category_compare') {
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
        color: scatterCompareSeriesData.value.map((series) => series.color ?? '#2563eb'),
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'line'
          },
          formatter: formatScatterCategoryCompareTooltip
        },
        legend: {
          show: scatterLegendVisible.value,
          top: chartTitle.value ? 22 : 0,
          textStyle: { color: '#4b5563' }
        },
        grid: {
          left: 12,
          right: 12,
          top: chartTitle.value ? 62 : scatterLegendVisible.value ? 40 : 18,
          bottom: 28,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: scatterCategories.value,
          name: scatterCategoryColumn.value || 'Category',
          nameGap: 20,
          axisLabel: scatterCategoryAxisLabel.value,
          axisLine: { lineStyle: { color: '#d1d5db' } }
        },
        yAxis: {
          type: 'value',
          name: 'Value',
          nameGap: 30,
          min: yAxisMin.value,
          max: yAxisMax.value,
          inverse: scatterYAxisInverse.value,
          axisLabel: { color: '#6b7280' },
          splitLine: { lineStyle: { color: '#e5e7eb' } }
        },
        series: scatterCompareSeriesData.value.map((series) => ({
          type: 'scatter',
          name: series.label ?? series.field,
          data: series.points,
          symbolSize: scaleScatterSymbolSize,
          itemStyle: {
            color: series.color ?? '#2563eb',
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
        }))
      }
    }

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
        min: yAxisMin.value,
        max: yAxisMax.value,
        inverse: scatterYAxisInverse.value,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: [
        {
          type: 'scatter',
          data: scatterNumericData.value,
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

  if (props.visualization === 'waterfall') {
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
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const first = params[0]
          if (!first) {
            return ''
          }
          const index = first.dataIndex
          if (index >= waterfallBreakdown.value.bars.length) {
            return `Total: ${waterfallBreakdown.value.total.toLocaleString()}`
          }

          const bar = waterfallBreakdown.value.bars[index]
          if (!bar) {
            return ''
          }
          const sign = bar.delta >= 0 ? '+' : ''
          return [
            `${bar.label}`,
            `Delta: ${sign}${bar.delta.toLocaleString()}`,
            `Running total: ${bar.totalAfter.toLocaleString()}`
          ].join('<br/>')
        }
      },
      legend: {
        show: waterfallShowLegend.value,
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
      xAxis: {
        type: 'category',
        data: waterfallCategories.value,
        axisLabel: {
          color: '#6b7280'
        },
        axisLine: {
          lineStyle: { color: '#d1d5db' }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#6b7280'
        },
        splitLine: {
          lineStyle: { color: '#e5e7eb' }
        }
      },
      series: [
        {
          name: 'Base',
          type: 'bar',
          stack: 'total',
          data: waterfallBaseSeries.value,
          silent: true,
          itemStyle: {
            color: 'transparent'
          },
          emphasis: {
            disabled: true
          }
        },
        {
          name: 'Delta',
          type: 'bar',
          stack: 'total',
          data: waterfallDeltaSeries.value,
          itemStyle: {
            borderRadius: barBorderRadius.value,
            color: (params: { dataIndex: number }) => {
              if (params.dataIndex >= waterfallBreakdown.value.bars.length) {
                return waterfallTotalColor.value
              }
              const bar = waterfallBreakdown.value.bars[params.dataIndex]
              return bar && bar.delta < 0
                ? waterfallNegativeColor.value
                : waterfallPositiveColor.value
            }
          },
          label: {
            show: true,
            position: 'top',
            color: '#374151',
            formatter: (params: { dataIndex: number }) => {
              if (params.dataIndex >= waterfallBreakdown.value.bars.length) {
                return waterfallBreakdown.value.total.toLocaleString()
              }
              const bar = waterfallBreakdown.value.bars[params.dataIndex]
              if (!bar) {
                return ''
              }
              const sign = bar.delta >= 0 ? '+' : ''
              return `${sign}${bar.delta.toLocaleString()}`
            }
          },
          emphasis: {
            focus: 'series'
          }
        }
      ]
    }
  }

  if (props.visualization === 'radar') {
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
        trigger: 'item'
      },
      legend: {
        show: showLegend.value,
        top: chartTitle.value ? 22 : 0,
        textStyle: {
          color: '#4b5563'
        }
      },
      radar: {
        indicator: radarIndicatorValues.value,
        center: ['50%', '56%'],
        radius: '62%',
        splitNumber: 4,
        axisName: {
          color: '#374151'
        },
        splitLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(249, 250, 251, 0.85)', 'rgba(243, 244, 246, 0.7)']
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: radarSeriesData.value.map((entry) => ({
            ...entry,
            areaStyle: {
              opacity: 0.08
            }
          })),
          emphasis: {
            focus: 'series'
          }
        }
      ]
    }
  }

  const isBar = isBarVisualization.value

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
          <div
            v-if="tableShowTabBar"
            class="flex flex-wrap gap-1 border-b border-gray-200 p-3"
          >
            <button
              v-for="group in tableTabGroups"
              :key="group.name"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="
                tableActiveTab === group.name
                  ? 'bg-brand-primary text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-gray-300'
              "
              @click="tableActiveTab = group.name"
            >
              {{ group.name }}
            </button>
          </div>
          <Table
            :rows="filteredTableRows"
            :columns="tableColumns"
            :cell-style-resolver="tableCellStyleResolver"
            :cell-value-formatter="tableCellValueFormatter"
            empty-label="No preview rows found."
          />
        </div>

        <div v-else-if="visualization === 'kpi'" class="p-4">
          <p class="text-xs uppercase tracking-wide text-gray-500">
            {{ kpiLabel }}
          </p>
          <p
            class="mt-2 text-3xl font-semibold"
            :style="{ color: kpiValueColor }"
          >
            {{ kpiDisplayValue }}
          </p>
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
            <template v-if="scatterMode === 'category_compare'">
              Category:
              <span class="font-medium text-gray-700">{{ scatterCategoryColumn || 'none' }}</span>
              | Series:
              <span class="font-medium text-gray-700">
                {{ scatterCompareSeriesData.map((series) => series.label || series.field).join(', ') || 'none' }}
              </span>
            </template>
            <template v-else>
              X: <span class="font-medium text-gray-700">{{ scatterXColumn || 'none' }}</span>
              | Y: <span class="font-medium text-gray-700">{{ scatterYColumn || 'none' }}</span>
              | Size: <span class="font-medium text-gray-700">{{ scatterSizeColumn || 'none' }}</span>
            </template>
          </p>
          <p
            v-else-if="visualization === 'waterfall'"
            class="mb-2 text-xs text-gray-500"
          >
            Category:
            <span class="font-medium text-gray-700">{{ waterfallCategoryColumn || 'none' }}</span>
            | Value:
            <span class="font-medium text-gray-700">{{ waterfallValueColumn || 'none' }}</span>
          </p>
          <p
            v-else-if="visualization === 'radar'"
            class="mb-2 text-xs text-gray-500"
          >
            Axis:
            <span class="font-medium text-gray-700">{{ radarCategoryColumn || 'row index' }}</span>
            | Series:
            <span class="font-medium text-gray-700">
              {{ seriesConfig.map((series) => series.label || series.field).join(', ') || 'none' }}
            </span>
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
            {{
              scatterMode === 'category_compare'
                ? 'Need one category field and at least one numeric series for scatter comparison.'
                : 'Need at least two numeric columns to render a scatter chart.'
            }}
          </p>
          <p
            v-else-if="visualization === 'waterfall' && !hasWaterfallData"
            class="text-sm text-gray-500"
          >
            Need one category column and one numeric value column for waterfall rendering.
          </p>
          <p
            v-else-if="visualization === 'radar' && !hasRadarData"
            class="text-sm text-gray-500"
          >
            Need one category axis and at least one numeric series for radar rendering.
          </p>
          <p
            v-else-if="visualization !== 'pie' && visualization !== 'scatter' && visualization !== 'waterfall' && visualization !== 'radar' && !hasCartesianData"
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
