<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import { useChartTooltip } from '~/composables/useChartTooltip'
import type { ModuleConfig } from '~/types/module'
import { readFractionDigits } from '~/utils/chart-number-format'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()
const { formatTooltipValueWithDigits } = useChartTooltip()

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

const mergeFractionDigits = (left: number | null, right: number | null) => {
  if (left === null) {
    return right
  }
  if (right === null) {
    return left
  }
  return Math.max(left, right)
}

const pieData = computed(() => {
  if (!categoryField.value || !valueField.value) {
    return [] as Array<{ name: string; value: number; fractionDigits: number | null }>
  }

  const totals = new Map<string, { value: number; fractionDigits: number | null }>()
  for (const row of rows.value) {
    const name = String(row[categoryField.value] ?? '').trim() || 'Unknown'
    const numeric = toNumber(row[valueField.value])
    if (numeric === null) {
      continue
    }
    const current = totals.get(name) ?? { value: 0, fractionDigits: null }
    totals.set(name, {
      value: current.value + numeric,
      fractionDigits: mergeFractionDigits(current.fractionDigits, readFractionDigits(row[valueField.value]))
    })
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: value.value, fractionDigits: value.fractionDigits }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN.value)
})

const hasData = computed(() => pieData.value.length > 0)

const donut = computed(() => {
  const value = props.module.config.donut
  return typeof value === 'boolean' ? value : true
})

const showLabels = computed(() => {
  const value = props.module.config.show_labels ?? props.module.config.showLabels
  return typeof value === 'boolean' ? value : false
})

const showLegend = computed(() => {
  const value = props.module.config.show_legend ?? props.module.config.showLegend
  return typeof value === 'boolean' ? value : true
})

const formatPieTooltip = (params: unknown) => {
  if (!params || typeof params !== 'object') {
    return ''
  }

  const record = params as Record<string, unknown>
  const dataRecord =
    record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null
  const name = String(record.name ?? '')
  const fractionDigits =
    typeof dataRecord?.fractionDigits === 'number' && Number.isFinite(dataRecord.fractionDigits)
      ? dataRecord.fractionDigits
      : null
  const value = formatTooltipValueWithDigits(record.value, fractionDigits)
  const percent =
    typeof record.percent === 'number' && Number.isFinite(record.percent)
      ? record.percent.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : ''

  return percent ? `${name}: ${value} (${percent}%)` : `${name}: ${value}`
}

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item',
    formatter: formatPieTooltip
  },
  legend: {
    show: showLegend.value,
    bottom: 0,
    type: 'scroll',
    textStyle: { color: '#4b5563' }
  },
  series: [
    {
      type: 'pie',
      radius: donut.value ? ['35%', '68%'] : ['0%', '72%'],
      center: ['50%', '42%'],
      itemStyle: {
        borderColor: '#ffffff',
        borderWidth: 2
      },
      label: {
        show: showLabels.value,
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
  <div class="h-full">
    <p v-if="!hasData" class="text-sm text-gray-500">
      No pie chart data available yet.
    </p>
    <div v-else class="h-full min-h-[220px]">
      <EChart :option="chartOption" height="100%" />
    </div>
  </div>
</template>
