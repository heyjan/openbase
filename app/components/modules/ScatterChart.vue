<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import type { ModuleConfig } from '~/types/module'

type ScatterPoint = {
  value: [number, number, number]
  name?: string
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

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

const readSizeBound = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return value > 0 ? value : fallback
}

const minSymbolSize = computed(() =>
  readSizeBound(props.module.config.min_symbol_size ?? props.module.config.minSymbolSize, 10)
)
const maxSymbolSize = computed(() =>
  readSizeBound(props.module.config.max_symbol_size ?? props.module.config.maxSymbolSize, 42)
)

const symbolRange = computed(() => ({
  min: Math.min(minSymbolSize.value, maxSymbolSize.value),
  max: Math.max(minSymbolSize.value, maxSymbolSize.value)
}))

const scatterData = computed<ScatterPoint[]>(() => {
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
        value: [x, y, size],
        name: labelText.trim() || undefined
      }
    })
    .filter((point): point is ScatterPoint => point !== null)
})

const sizeExtent = computed(() => {
  const sizes = scatterData.value.map((item) => item.value[2])
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

const hasData = computed(() => scatterData.value.length > 0)

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item'
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
    axisLabel: { color: '#6b7280' },
    splitLine: { lineStyle: { color: '#e5e7eb' } }
  },
  series: [
    {
      type: 'scatter',
      data: scatterData.value,
      symbolSize: dynamicSymbolSize,
      itemStyle: {
        color: '#2563eb',
        opacity: 0.78
      },
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
      No scatter data available yet.
    </p>
    <template v-else>
      <div class="h-full min-h-[220px]">
        <EChart :option="chartOption" height="100%" />
      </div>
      <p class="mt-2 text-xs text-gray-500">
        X: {{ xField || 'none' }} | Y: {{ yField || 'none' }} | Size: {{ sizeField || 'none' }}
      </p>
    </template>
  </div>
</template>
