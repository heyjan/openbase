<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

type SeriesConfig = {
  field: string
  label: string
  color: string
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const palette = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#9333ea']

const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 52).reverse())
const columns = computed(() => props.moduleData?.columns ?? [])

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
      const label = typeof record.label === 'string' && record.label.trim()
        ? record.label
        : field
      const color = typeof record.color === 'string' && record.color.trim()
        ? record.color
        : palette[index % palette.length]
      return { field, label, color }
    })
    .filter((item): item is SeriesConfig => item !== null)
})

const series = computed(() =>
  configuredSeries.value.length ? configuredSeries.value : inferredSeries.value
)

const chartWidth = 680
const chartHeight = 240
const chartPadding = { top: 14, right: 14, bottom: 20, left: 12 }

const numericValues = computed(() => {
  const values: number[] = []
  for (const row of rows.value) {
    for (const currentSeries of series.value) {
      const numeric = toNumber(row[currentSeries.field])
      if (numeric !== null) {
        values.push(numeric)
      }
    }
  }
  return values
})

const yBounds = computed(() => {
  if (!numericValues.value.length) {
    return { min: 0, max: 1, range: 1 }
  }
  const min = Math.min(...numericValues.value)
  const max = Math.max(...numericValues.value)
  const range = max - min || 1
  return { min, max, range }
})

const seriesPoints = computed(() => {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const length = rows.value.length
  if (!length) {
    return []
  }

  return series.value.map((currentSeries) => {
    const points: string[] = []
    rows.value.forEach((row, index) => {
      const numeric = toNumber(row[currentSeries.field])
      if (numeric === null) {
        return
      }
      const x = chartPadding.left + (length <= 1 ? 0 : (index / (length - 1)) * plotWidth)
      const y =
        chartPadding.top +
        plotHeight -
        ((numeric - yBounds.value.min) / yBounds.value.range) * plotHeight
      points.push(`${x},${y}`)
    })
    return {
      ...currentSeries,
      points: points.join(' '),
      hasPoints: points.length > 1
    }
  })
})

const startLabel = computed(() => {
  const first = rows.value[0]
  if (!first) {
    return ''
  }
  if (xField.value === 'index') {
    return 'Start'
  }
  return String(first[xField.value] ?? '')
})

const endLabel = computed(() => {
  const last = rows.value[rows.value.length - 1]
  if (!last) {
    return ''
  }
  if (xField.value === 'index') {
    return 'End'
  }
  return String(last[xField.value] ?? '')
})

const hasData = computed(() => rows.value.length > 0 && series.value.length > 0)
</script>

<template>
  <div>
    <p v-if="!hasData" class="text-sm text-gray-500">
      No chart data available yet.
    </p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span
          v-for="item in series"
          :key="item.field"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: item.color }"
          ></span>
          {{ item.label }}
        </span>
      </div>

      <div class="mt-3 overflow-hidden rounded border border-gray-100 bg-gray-50">
        <svg
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
          class="h-56 w-full"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            :y1="chartHeight - 20"
            :x2="chartWidth"
            :y2="chartHeight - 20"
            stroke="#e5e7eb"
            stroke-width="1"
          />
          <line
            x1="0"
            y1="14"
            :x2="chartWidth"
            y2="14"
            stroke="#f3f4f6"
            stroke-width="1"
          />
          <polyline
            v-for="item in seriesPoints"
            :key="item.field"
            :points="item.points"
            fill="none"
            :stroke="item.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :opacity="item.hasPoints ? 1 : 0.35"
          />
        </svg>
      </div>

      <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{{ startLabel }}</span>
        <span>{{ endLabel }}</span>
      </div>

      <p class="mt-3 text-xs text-gray-500">
        Rows: {{ rows.length }} | Columns: {{ columns.length }}
      </p>
    </template>
  </div>
</template>
