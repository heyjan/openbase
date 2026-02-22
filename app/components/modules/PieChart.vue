<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import type { ModuleConfig } from '~/types/module'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

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

const categoryField = computed(() => {
  const configured = props.module.config.category_field ?? props.module.config.categoryField
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
  return ''
})

const valueField = computed(() => {
  const configured = props.module.config.value_field ?? props.module.config.valueField
  if (typeof configured === 'string' && configured.trim()) {
    return configured
  }
  const first = rows.value[0]
  if (!first) {
    return ''
  }
  for (const key of Object.keys(first)) {
    if (toNumber(first[key]) !== null) {
      return key
    }
  }
  return ''
})

const topN = computed(() => {
  const raw = props.module.config.top_n ?? props.module.config.topN
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  return 8
})

const pieData = computed(() => {
  if (!categoryField.value || !valueField.value) {
    return [] as Array<{ name: string; value: number }>
  }

  const totals = new Map<string, number>()
  for (const row of rows.value) {
    const name = String(row[categoryField.value] ?? '').trim() || 'Unknown'
    const numeric = toNumber(row[valueField.value])
    if (numeric === null) {
      continue
    }
    totals.set(name, (totals.get(name) ?? 0) + numeric)
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN.value)
})

const hasData = computed(() => pieData.value.length > 0)

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: 0,
    type: 'scroll',
    textStyle: { color: '#4b5563' }
  },
  series: [
    {
      type: 'pie',
      radius: ['35%', '68%'],
      center: ['50%', '42%'],
      itemStyle: {
        borderColor: '#ffffff',
        borderWidth: 2
      },
      label: {
        color: '#374151'
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 12,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.16)'
        }
      },
      data: pieData.value
    }
  ]
}))
</script>

<template>
  <div>
    <p v-if="!hasData" class="text-sm text-gray-500">
      No pie chart data available yet.
    </p>
    <template v-else>
      <EChart :option="chartOption" height="280px" />
      <p class="mt-3 text-xs text-gray-500">
        Using {{ categoryField || 'category' }} / {{ valueField || 'value' }} from {{ columns.length }} columns.
      </p>
    </template>
  </div>
</template>
