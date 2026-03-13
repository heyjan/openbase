<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import { useChartTooltip } from '~/composables/useChartTooltip'
import type { ModuleConfig } from '~/types/module'

type SeriesConfig = {
  field: string
  label: string
  color: string
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()
const { renderAxisTooltip } = useChartTooltip()

const palette = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#9333ea', '#0f766e']
const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 80).reverse())

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

const xField = computed(() => {
  const configured = props.module.config.x_field ?? props.module.config.xField
  if (typeof configured === 'string' && configured.trim()) {
    return configured
  }
  const first = rows.value[0]
  if (!first) {
    return ''
  }
  for (const key of Object.keys(first)) {
    if (toNumber(first[key]) === null) {
      return key
    }
  }
  return 'index'
})

const inferredSeries = computed<SeriesConfig[]>(() => {
  const first = rows.value[0]
  if (!first) {
    return []
  }
  const numericFields = Object.keys(first).filter((key) => toNumber(first[key]) !== null)
  return numericFields.slice(0, 4).map((field, index) => ({
    field,
    label: field,
    color: palette[index % palette.length]
  }))
})

const configuredSeries = computed<SeriesConfig[]>(() => {
  const raw = props.module.config.series
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const record = item as Record<string, unknown>
      const field = typeof record.field === 'string' ? record.field.trim() : ''
      if (!field) {
        return null
      }
      const label =
        typeof record.label === 'string' && record.label.trim() ? record.label.trim() : field
      const color =
        typeof record.color === 'string' && record.color.trim()
          ? record.color.trim()
          : palette[index % palette.length]
      return { field, label, color }
    })
    .filter((item): item is SeriesConfig => item !== null)
})

const series = computed(() =>
  configuredSeries.value.length ? configuredSeries.value : inferredSeries.value
)

const hasData = computed(() => rows.value.length > 0 && series.value.length > 0)

const categories = computed(() =>
  rows.value.map((row, index) => {
    if (xField.value === 'index') {
      return String(index + 1)
    }
    return String(row[xField.value] ?? index + 1)
  })
)

const stackedBars = computed(() => {
  const value = props.module.config.stacked
  if (typeof value === 'boolean') {
    return value
  }
  return props.module.type === 'stacked_horizontal_bar_chart'
})

const horizontal = computed(() => {
  const value = props.module.config.horizontal
  if (typeof value === 'boolean') {
    return value
  }
  return props.module.type === 'stacked_horizontal_bar_chart'
})

const showLegend = computed(() => {
  const value = props.module.config.show_legend ?? props.module.config.showLegend
  return typeof value === 'boolean' ? value : true
})

const barBorderRadius = computed(() => {
  const value = props.module.config.bar_border_radius ?? props.module.config.barBorderRadius
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 4
  }
  if (value < 0) {
    return 0
  }
  return value > 12 ? 12 : value
})

const categoryLabelRotation = computed(() => {
  const rawValue =
    props.module.config.x_axis_label_rotation ??
    props.module.config.xAxisLabelRotation ??
    props.module.config.category_label_rotation ??
    props.module.config.categoryLabelRotation ??
    props.module.config.axis_label_rotate ??
    props.module.config.axisLabelRotate

  const parsed =
    typeof rawValue === 'string' && rawValue.trim() ? Number(rawValue) : rawValue

  if (parsed === 45 || parsed === 90) {
    return parsed
  }

  return 0
})

const categoryAxisLabel = computed(() => ({
  color: '#6b7280',
  rotate: categoryLabelRotation.value,
  interval: categoryLabelRotation.value > 0 ? 0 : undefined,
  hideOverlap: categoryLabelRotation.value > 0 ? false : undefined
}))

const chartOption = computed<EChartsOption>(() => ({
  color: series.value.map((item) => item.color),
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: unknown) =>
      renderAxisTooltip(params, { sortByValue: stackedBars.value })
  },
  legend: {
    show: showLegend.value,
    top: 0,
    textStyle: { color: '#4b5563' }
  },
  grid: {
    left: 12,
    right: 12,
    top: 40,
    bottom: 28,
    containLabel: true
  },
  xAxis: horizontal.value
    ? {
        type: 'value',
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      }
    : {
        type: 'category',
        data: categories.value,
        axisLabel: categoryAxisLabel.value,
        axisLine: { lineStyle: { color: '#d1d5db' } }
      },
  yAxis: horizontal.value
    ? {
        type: 'category',
        data: categories.value,
        axisLabel: categoryAxisLabel.value,
        axisLine: { lineStyle: { color: '#d1d5db' } }
      }
    : {
        type: 'value',
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
  series: series.value.map((item) => ({
    type: 'bar',
    name: item.label,
    stack: stackedBars.value ? 'total' : undefined,
    emphasis: { focus: 'series' },
    itemStyle: {
      borderRadius: barBorderRadius.value
    },
    data: rows.value.map((row) => {
      const value = toNumber(row[item.field])
      if (value === null) {
        return null
      }
      return {
        value,
        rawValue: row[item.field]
      }
    })
  }))
}))
</script>

<template>
  <div class="h-full">
    <p v-if="!hasData" class="text-sm text-gray-500">
      No bar chart data available yet.
    </p>
    <div v-else class="h-full min-h-[220px]">
      <EChart :option="chartOption" height="100%" />
    </div>
  </div>
</template>
