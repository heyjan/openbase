<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const KPI_VALUE_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2
})
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const rows = computed(() => props.moduleData?.rows ?? [])
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

const readConfigString = (keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'string') {
      return value
    }
  }
  return ''
}

const readTrimmedConfigString = (keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
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

const configuredValueField = computed(() =>
  readTrimmedConfigString(['valueField', 'value_field', 'metricField', 'metric_field'])
)

const valueField = computed(() => {
  if (configuredValueField.value) {
    return configuredValueField.value
  }

  for (const column of columns.value) {
    if (rows.value.some((row) => toNumber(row[column]) !== null)) {
      return column
    }
  }

  return columns.value[0] ?? ''
})

const label = computed(
  () =>
    readTrimmedConfigString(['label']) ||
    readTrimmedConfigString(['titleOverride']) ||
    props.module.title?.trim() ||
    valueField.value ||
    'KPI'
)

const prefix = computed(() => readConfigString(['prefix', 'valuePrefix', 'value_prefix']))
const postfix = computed(() => readConfigString(['postfix', 'suffix', 'valuePostfix', 'value_postfix']))
const valueColor = computed(
  () =>
    normalizeHexColor(readConfigString(['valueColor', 'value_color', 'textColor', 'text_color'])) ??
    '#111827'
)

const rawValue = computed(() => {
  if (!valueField.value || !rows.value.length) {
    return null
  }
  return rows.value[0]?.[valueField.value]
})

const displayValue = computed(() => {
  const value = rawValue.value
  if (value === null || value === undefined || value === '') {
    return 'No data'
  }

  const numeric = toNumber(value)
  if (numeric !== null) {
    return `${prefix.value}${KPI_VALUE_FORMATTER.format(numeric)}${postfix.value}`
  }

  return `${prefix.value}${String(value)}${postfix.value}`
})
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <p class="text-xs uppercase tracking-wide text-gray-500">
      {{ label }}
    </p>
    <p class="mt-2 text-3xl font-semibold leading-tight" :style="{ color: valueColor }">
      {{ displayValue }}
    </p>
  </div>
</template>
