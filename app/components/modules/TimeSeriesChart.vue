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

const palette = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 120).reverse())

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
  return numericFields.slice(0, 6).map((field, index) => ({
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
    const value = row[xField.value]
    return String(value ?? index + 1)
  })
)

const smoothLines = computed(() => {
  const value = props.module.config.smooth
  if (typeof value === 'boolean') {
    return value
  }
  return true
})

const showArea = computed(() => {
  const value = props.module.config.area
  return typeof value === 'boolean' ? value : false
})

const showSymbols = computed(() => {
  const value = props.module.config.show_symbols ?? props.module.config.showSymbols
  return typeof value === 'boolean' ? value : false
})

const chartOption = computed<EChartsOption>(() => ({
  color: series.value.map((item) => item.color),
  tooltip: {
    trigger: 'axis'
  },
  legend: {
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
  xAxis: {
    type: 'category',
    data: categories.value,
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
  series: series.value.map((item) => ({
    type: 'line',
    name: item.label,
    smooth: smoothLines.value,
    showSymbol: showSymbols.value,
    areaStyle: showArea.value ? { opacity: 0.18 } : undefined,
    emphasis: {
      focus: 'series'
    },
    data: rows.value.map((row) => toNumber(row[item.field]))
  }))
}))
</script>

<template>
  <div class="h-full">
    <p v-if="!hasData" class="text-sm text-gray-500">
      No chart data available yet.
    </p>
    <div v-else class="h-full min-h-[220px]">
      <EChart :option="chartOption" height="100%" />
    </div>
  </div>
</template>
