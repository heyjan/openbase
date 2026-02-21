<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const rows = computed(() => props.moduleData?.rows ?? [])

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

const configMetricField = computed(() => {
  const field =
    props.module.config.value_field ??
    props.module.config.valueField ??
    props.module.config.metric_field ??
    props.module.config.metricField
  return typeof field === 'string' ? field : ''
})

const metricField = computed(() => {
  if (configMetricField.value) {
    return configMetricField.value
  }
  const firstRow = rows.value[0]
  if (!firstRow) {
    return ''
  }
  for (const key of Object.keys(firstRow)) {
    if (toNumber(firstRow[key]) !== null) {
      return key
    }
  }
  return ''
})

const currentValue = computed(() => {
  const field = metricField.value
  if (!field || !rows.value.length) {
    return null
  }
  return toNumber(rows.value[0][field])
})

const previousValue = computed(() => {
  const field = metricField.value
  if (!field || rows.value.length < 2) {
    return null
  }
  return toNumber(rows.value[1][field])
})

const deltaPercent = computed(() => {
  if (currentValue.value === null || previousValue.value === null || previousValue.value === 0) {
    return null
  }
  return ((currentValue.value - previousValue.value) / Math.abs(previousValue.value)) * 100
})

const formatType = computed(() => {
  const raw = props.module.config.format
  return typeof raw === 'string' ? raw : 'number'
})

const currency = computed(() => {
  const raw = props.module.config.currency
  return typeof raw === 'string' && raw.trim() ? raw : 'USD'
})

const formatValue = (value: number | null) => {
  if (value === null) {
    return 'No data'
  }
  if (formatType.value === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.value,
      maximumFractionDigits: 2
    }).format(value)
  }
  if (formatType.value === 'percentage') {
    const fraction = Math.abs(value) <= 1 ? value : value / 100
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      maximumFractionDigits: 1
    }).format(fraction)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

const trendClass = computed(() => {
  if (deltaPercent.value === null) {
    return 'text-gray-500'
  }
  return deltaPercent.value >= 0 ? 'text-emerald-600' : 'text-red-600'
})

const sparklineValues = computed(() => {
  const field = metricField.value
  if (!field) {
    return []
  }
  return rows.value
    .slice(0, 12)
    .reverse()
    .map((row) => toNumber(row[field]))
    .filter((value): value is number => value !== null)
})

const sparklinePoints = computed(() => {
  const values = sparklineValues.value
  if (values.length < 2) {
    return ''
  }
  const width = 160
  const height = 44
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
})
</script>

<template>
  <div>
    <p class="text-3xl font-semibold text-gray-900">
      {{ formatValue(currentValue) }}
    </p>

    <div class="mt-2 flex items-center gap-2 text-sm">
      <span :class="trendClass">
        <template v-if="deltaPercent !== null">
          {{ deltaPercent >= 0 ? '▲' : '▼' }}
          {{ Math.abs(deltaPercent).toFixed(1) }}%
        </template>
        <template v-else>
          --
        </template>
      </span>
      <span class="text-gray-500">
        vs previous
      </span>
    </div>

    <div v-if="sparklinePoints" class="mt-4">
      <svg
        viewBox="0 0 160 44"
        class="h-11 w-full"
        preserveAspectRatio="none"
      >
        <polyline
          :points="sparklinePoints"
          fill="none"
          stroke="currentColor"
          class="text-gray-900"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <p v-if="metricField" class="mt-2 text-xs text-gray-500">
      Metric: {{ metricField }}
    </p>
  </div>
</template>
