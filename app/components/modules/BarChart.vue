<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
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

const toTooltipValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (Array.isArray(value)) {
    return toTooltipValue(value[value.length - 1])
  }
  return 0
}

const formatTooltipValue = (value: unknown) => toTooltipValue(value).toLocaleString()

const formatSortedTooltip = (params: unknown) => {
  if (!Array.isArray(params) || !params.length) {
    return ''
  }

  const items = (params as Array<Record<string, unknown>>).map((item) => ({
    seriesName: String(item.seriesName ?? ''),
    value: item.value,
    color: String(item.color ?? '#6b7280'),
    axisValueLabel: String(item.axisValueLabel ?? '')
  }))

  const sorted = [...items].sort((left, right) => toTooltipValue(right.value) - toTooltipValue(left.value))
  const header = sorted[0]?.axisValueLabel
    ? `<div style="font-weight:600;margin-bottom:4px">${sorted[0].axisValueLabel}</div>`
    : ''
  const rows = sorted
    .map((item) => {
      return `<div style="display:flex;align-items:center;gap:6px;line-height:1.6">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color}"></span>
        <span>${item.seriesName}</span>
        <span style="margin-left:auto;font-weight:500">${formatTooltipValue(item.value)}</span>
      </div>`
    })
    .join('')

  return header + rows
}

const chartOption = computed<EChartsOption>(() => ({
  color: series.value.map((item) => item.color),
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: stackedBars.value ? formatSortedTooltip : undefined
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
        axisLabel: { color: '#6b7280' },
        axisLine: { lineStyle: { color: '#d1d5db' } }
      },
  yAxis: horizontal.value
    ? {
        type: 'category',
        data: categories.value,
        axisLabel: { color: '#6b7280' },
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
    data: rows.value.map((row) => toNumber(row[item.field]))
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
