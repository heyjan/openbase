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
const { renderLabelValueRows } = useChartTooltip()

const palette = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']

const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 80))

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

const categories = computed(() =>
  rows.value.map((row, index) => {
    if (xField.value === 'index') {
      return String(index + 1)
    }
    const value = row[xField.value]
    return String(value ?? index + 1)
  })
)

const showLegend = computed(() => {
  const value = props.module.config.show_legend ?? props.module.config.showLegend
  return typeof value === 'boolean' ? value : true
})

const indicators = computed(() =>
  categories.value.map((name, index) => {
    const values = series.value
      .map((item) => toNumber(rows.value[index]?.[item.field]))
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
  series.value.map((item) => ({
    name: item.label,
    value: rows.value.map((row) => toNumber(row[item.field]) ?? 0),
    rawValues: rows.value.map((row) => row[item.field]),
    areaStyle: {
      opacity: 0.08
    }
  }))
)

const hasData = computed(() => indicators.value.length > 2 && series.value.length > 0)

const formatRadarTooltip = (params: unknown) => {
  if (!params || typeof params !== 'object') {
    return ''
  }

  const record = params as Record<string, unknown>
  const dataRecord =
    record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null
  const values = Array.isArray(dataRecord?.value) ? dataRecord.value : []
  const rawValues = Array.isArray(dataRecord?.rawValues) ? dataRecord.rawValues : []
  const headerLabel = String(record.seriesName ?? dataRecord?.name ?? '')
  return renderLabelValueRows({
    header: headerLabel || undefined,
    rows: values.map((value, index) => ({
      label: categories.value[index] ?? `Item ${index + 1}`,
      value,
      rawValue: rawValues[index]
    }))
  })
}

const chartOption = computed<EChartsOption>(() => ({
  color: series.value.map((item) => item.color),
  tooltip: {
    trigger: 'item',
    formatter: formatRadarTooltip
  },
  legend: {
    show: showLegend.value,
    top: 0,
    textStyle: { color: '#4b5563' }
  },
  radar: {
    indicator: indicators.value,
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
      data: radarSeriesData.value,
      emphasis: {
        focus: 'series'
      }
    }
  ]
}))
</script>

<template>
  <div class="h-full">
    <p v-if="!hasData" class="text-sm text-gray-500">
      No radar chart data available yet.
    </p>
    <div v-else class="h-full min-h-[220px]">
      <EChart :option="chartOption" height="100%" />
    </div>
  </div>
</template>
