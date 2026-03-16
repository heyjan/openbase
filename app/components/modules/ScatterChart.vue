<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import { useChartTooltip } from '~/composables/useChartTooltip'
import type { ModuleConfig } from '~/types/module'
import type { ScatterCompareSeriesOption, ScatterVizMode } from '~/types/viz-options'

type ScatterNumericPoint = {
  value: [number, number, number]
  rawValue: [unknown, unknown, unknown]
  name?: string
}

type ScatterCategoryPoint = {
  value: [string, number, number]
  rawValue: [unknown, unknown, unknown]
  sizeField: string
  name?: string
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()
const { renderLabelValueRows } = useChartTooltip()
const palette = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']

const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 200))
const columns = computed(() => {
  const listedColumns = props.moduleData?.columns ?? []
  if (listedColumns.length) {
    return listedColumns
  }
  return Object.keys(rows.value[0] ?? {})
})

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const columnIsNumeric = (column: string) => {
  let sawValue = false
  for (const row of rows.value) {
    const value = row[column]
    if (value === null || value === undefined || value === '') {
      continue
    }
    sawValue = true
    if (toNumber(value) === null) {
      return false
    }
  }
  return sawValue
}

const numericColumns = computed(() => columns.value.filter((column) => columnIsNumeric(column)))
const categoryColumns = computed(() =>
  columns.value.filter((column) => !numericColumns.value.includes(column))
)

const readConfigField = (...keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}
const scatterMode = computed<ScatterVizMode>(() =>
  readConfigField('mode', 'scatter_mode', 'scatterMode') === 'category_compare'
    ? 'category_compare'
    : 'numeric'
)

const xField = computed(() => readConfigField('x_field', 'xField') || numericColumns.value[0] || '')
const yField = computed(() => {
  const configured = readConfigField('y_field', 'yField')
  if (configured) {
    return configured
  }
  return numericColumns.value.find((column) => column !== xField.value) || numericColumns.value[1] || ''
})
const sizeField = computed(() => {
  const configured = readConfigField('size_field', 'sizeField')
  if (configured) {
    return configured
  }

  return (
    numericColumns.value.find(
      (column) => column !== xField.value && column !== yField.value
    ) ||
    yField.value ||
    ''
  )
})
const labelField = computed(
  () => readConfigField('label_field', 'labelField') || categoryColumns.value[0] || ''
)
const categoryField = computed(
  () =>
    readConfigField('category_field', 'categoryField', 'x_field', 'xField') ||
    categoryColumns.value[0] ||
    columns.value[0] ||
    ''
)

const readSizeBound = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return value > 0 ? value : fallback
}

const readOptionalNumber = (...keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

const minSymbolSize = computed(() =>
  readSizeBound(props.module.config.min_symbol_size ?? props.module.config.minSymbolSize, 10)
)
const maxSymbolSize = computed(() =>
  readSizeBound(props.module.config.max_symbol_size ?? props.module.config.maxSymbolSize, 42)
)

const showLabels = computed(() => {
  const value = props.module.config.show_labels ?? props.module.config.showLabels
  return typeof value === 'boolean' ? value : false
})
const yAxisMin = computed(() => readOptionalNumber('y_axis_min', 'yAxisMin'))
const yAxisMax = computed(() => readOptionalNumber('y_axis_max', 'yAxisMax'))
const yAxisInverse = computed(() => {
  const value = props.module.config.y_axis_inverse ?? props.module.config.yAxisInverse
  return typeof value === 'boolean' ? value : false
})

const symbolRange = computed(() => ({
  min: Math.min(minSymbolSize.value, maxSymbolSize.value),
  max: Math.max(minSymbolSize.value, maxSymbolSize.value)
}))

const numericScatterData = computed<ScatterNumericPoint[]>(() => {
  if (!xField.value || !yField.value) {
    return []
  }

  return rows.value
    .map((row) => {
      const x = toNumber(row[xField.value])
      const y = toNumber(row[yField.value])
      const size = toNumber(row[sizeField.value]) ?? toNumber(row[yField.value]) ?? null

      if (x === null || y === null || size === null) {
        return null
      }

      const labelText =
        labelField.value && row[labelField.value] !== undefined && row[labelField.value] !== null
          ? String(row[labelField.value])
          : ''

      return {
        value: [x, y, size] as [number, number, number],
        rawValue: [row[xField.value], row[yField.value], row[sizeField.value] ?? row[yField.value]],
        name: labelText.trim() || undefined
      }
    })
    .filter((point): point is ScatterNumericPoint => point !== null)
})

const configuredCompareSeries = computed<ScatterCompareSeriesOption[]>(() => {
  const raw = props.module.config.series
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
  if (!categoryField.value) {
    return [] as string[]
  }

  const values: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < rows.value.length; index += 1) {
    const row = rows.value[index]
    const category = String(row[categoryField.value] ?? `Item ${index + 1}`).trim() || `Item ${index + 1}`
    if (seen.has(category)) {
      continue
    }
    seen.add(category)
    values.push(category)
  }
  return values
})

const categoryCompareSeriesData = computed(() =>
  configuredCompareSeries.value
    .map((series) => ({
      ...series,
      points: rows.value
        .map((row, rowIndex) => {
          const category =
            String(row[categoryField.value] ?? `Item ${rowIndex + 1}`).trim() || `Item ${rowIndex + 1}`
          const y = toNumber(row[series.field])
          const size = toNumber(row[series.sizeField ?? series.field]) ?? y

          if (y === null || size === null) {
            return null
          }

          return {
            value: [category, y, size] as [string, number, number],
            rawValue: [row[categoryField.value], row[series.field], row[series.sizeField ?? series.field]],
            sizeField: series.sizeField ?? series.field,
            name: category
          } satisfies ScatterCategoryPoint
        })
        .filter((point): point is ScatterCategoryPoint => point !== null)
    }))
    .filter((series) => series.points.length > 0)
)

const sizeExtent = computed(() => {
  const sizes =
    scatterMode.value === 'category_compare'
      ? categoryCompareSeriesData.value.flatMap((series) => series.points.map((point) => point.value[2]))
      : numericScatterData.value.map((item) => item.value[2])
  if (!sizes.length) {
    return { min: 0, max: 0 }
  }
  return {
    min: Math.min(...sizes),
    max: Math.max(...sizes)
  }
})

const dynamicSymbolSize = (value: unknown) => {
  if (!Array.isArray(value)) {
    return symbolRange.value.min
  }

  const rawSize = Number(value[2])
  if (!Number.isFinite(rawSize)) {
    return symbolRange.value.min
  }

  const span = sizeExtent.value.max - sizeExtent.value.min
  if (span <= 0) {
    return (symbolRange.value.min + symbolRange.value.max) / 2
  }

  const ratio = (rawSize - sizeExtent.value.min) / span
  const clamped = Math.max(0, Math.min(1, ratio))
  return symbolRange.value.min + clamped * (symbolRange.value.max - symbolRange.value.min)
}

const hasData = computed(() =>
  scatterMode.value === 'category_compare'
    ? categoryCompareSeriesData.value.length > 0
    : numericScatterData.value.length > 0
)
const scatterLegendVisible = computed(
  () => scatterMode.value === 'category_compare' && categoryCompareSeriesData.value.length > 1
)

const formatScatterTooltip = (params: unknown) => {
  if (!params || typeof params !== 'object') {
    return ''
  }

  const record = params as Record<string, unknown>
  const dataRecord =
    record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null
  const values = Array.isArray(dataRecord?.value) ? dataRecord.value : []
  const rawValues = Array.isArray(dataRecord?.rawValue) ? dataRecord.rawValue : []
  const name = String(dataRecord?.name ?? values[0] ?? '')

  if (scatterMode.value === 'category_compare') {
    const seriesName = String(record.seriesName ?? '')
    const sizeField =
      typeof dataRecord?.sizeField === 'string' && dataRecord.sizeField.trim()
        ? dataRecord.sizeField.trim()
        : 'Size'
    return renderLabelValueRows({
      header: name || undefined,
      rows: [
        {
          label: seriesName || 'Series',
          value: values[1],
          rawValue: rawValues[1],
          color: String(record.color ?? '#2563eb')
        },
        {
          label: sizeField,
          value: values[2],
          rawValue: rawValues[2]
        }
      ]
    })
  }

  return renderLabelValueRows({
    header: name || undefined,
    rows: [
      {
        label: xField.value || 'X',
        value: values[0],
        rawValue: rawValues[0]
      },
      {
        label: yField.value || 'Y',
        value: values[1],
        rawValue: rawValues[1]
      },
      {
        label: sizeField.value || 'Size',
        value: values[2],
        rawValue: rawValues[2]
      }
    ]
  })
}

const chartOption = computed<EChartsOption>(() => {
  if (scatterMode.value === 'category_compare') {
    return {
      color: categoryCompareSeriesData.value.map((series) => series.color ?? '#2563eb'),
      tooltip: {
        trigger: 'item',
        formatter: formatScatterTooltip
      },
      legend: {
        show: scatterLegendVisible.value,
        top: 0,
        textStyle: { color: '#4b5563' }
      },
      grid: {
        left: 14,
        right: 14,
        top: scatterLegendVisible.value ? 40 : 14,
        bottom: 30,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: scatterCategories.value,
        name: categoryField.value || 'Category',
        nameGap: 20,
        axisLabel: { color: '#6b7280' },
        axisLine: { lineStyle: { color: '#d1d5db' } }
      },
      yAxis: {
        type: 'value',
        name: 'Value',
        nameGap: 30,
        min: yAxisMin.value,
        max: yAxisMax.value,
        inverse: yAxisInverse.value,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: categoryCompareSeriesData.value.map((series) => ({
        type: 'scatter',
        name: series.label ?? series.field,
        data: series.points,
        symbolSize: dynamicSymbolSize,
        itemStyle: {
          color: series.color ?? '#2563eb',
          opacity: 0.78
        },
        label: {
          show: showLabels.value,
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
    tooltip: {
      trigger: 'item',
      formatter: formatScatterTooltip
    },
    grid: {
      left: 14,
      right: 14,
      top: 14,
      bottom: 30,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: xField.value || 'X',
      nameGap: 20,
      axisLabel: { color: '#6b7280' },
      splitLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: {
      type: 'value',
      name: yField.value || 'Y',
      nameGap: 30,
      min: yAxisMin.value,
      max: yAxisMax.value,
      inverse: yAxisInverse.value,
      axisLabel: { color: '#6b7280' },
      splitLine: { lineStyle: { color: '#e5e7eb' } }
    },
    series: [
      {
        type: 'scatter',
        data: numericScatterData.value,
        symbolSize: dynamicSymbolSize,
        itemStyle: {
          color: '#2563eb',
          opacity: 0.78
        },
        label: {
          show: showLabels.value,
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
})
</script>

<template>
  <div class="h-full">
    <p v-if="!hasData" class="text-sm text-gray-500">
      No scatter data available yet.
    </p>
    <template v-else>
      <div class="h-full min-h-[220px]">
        <EChart :option="chartOption" height="100%" />
      </div>
      <p class="mt-2 text-xs text-gray-500">
        <template v-if="scatterMode === 'category_compare'">
          Category: {{ categoryField || 'none' }} | Series:
          {{ categoryCompareSeriesData.map((series) => series.label || series.field).join(', ') || 'none' }}
        </template>
        <template v-else>
          X: {{ xField || 'none' }} | Y: {{ yField || 'none' }} | Size: {{ sizeField || 'none' }}
        </template>
      </p>
    </template>
  </div>
</template>
