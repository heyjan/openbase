<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import type { ModuleDataResult } from '~/composables/useModuleData'
import { useChartTooltip } from '~/composables/useChartTooltip'
import type { ModuleConfig } from '~/types/module'
import { readFractionDigits } from '~/utils/chart-number-format'

type WaterfallPoint = {
  label: string
  delta: number
  rawDelta: unknown
  fractionDigits: number | null
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()
const { formatTooltipValue, formatTooltipValueWithDigits } = useChartTooltip()

const rows = computed(() => (props.moduleData?.rows ?? []).slice(0, 80))
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

const numericColumns = computed(() =>
  columns.value.filter((column) =>
    rows.value.some((row) => toNumber(row[column]) !== null)
  )
)
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

const readConfigBoolean = (fallback: boolean, ...keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return fallback
}

const readConfigNumber = (fallback: number, ...keys: string[]) => {
  for (const key of keys) {
    const value = props.module.config[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return fallback
}

const categoryField = computed(
  () =>
    readConfigField('category_field', 'categoryField', 'x_field', 'xField') ||
    categoryColumns.value[0] ||
    columns.value[0] ||
    ''
)

const valueField = computed(() => {
  const configured = readConfigField('value_field', 'valueField')
  if (configured) {
    return configured
  }
  return (
    numericColumns.value.find((column) => column !== categoryField.value) ||
    numericColumns.value[0] ||
    ''
  )
})

const positiveColor = computed(
  () => readConfigField('positive_color', 'positiveColor') || '#16a34a'
)
const negativeColor = computed(
  () => readConfigField('negative_color', 'negativeColor') || '#dc2626'
)
const totalColor = computed(
  () => readConfigField('total_color', 'totalColor') || '#2563eb'
)

const showLegend = computed(() => readConfigBoolean(false, 'show_legend', 'showLegend'))

const barBorderRadius = computed(() => {
  const radius = readConfigNumber(4, 'bar_border_radius', 'barBorderRadius')
  if (radius < 0) {
    return 0
  }
  return radius > 12 ? 12 : radius
})

const points = computed<WaterfallPoint[]>(() => {
  if (!categoryField.value || !valueField.value) {
    return []
  }

  return rows.value
    .map((row, index) => {
      const label = String(row[categoryField.value] ?? '').trim() || `Item ${index + 1}`
      const delta = toNumber(row[valueField.value])
      if (delta === null) {
        return null
      }

      return {
        label,
        delta,
        rawDelta: row[valueField.value],
        fractionDigits: readFractionDigits(row[valueField.value])
      } satisfies WaterfallPoint
    })
    .filter((point): point is WaterfallPoint => point !== null)
})

const breakdown = computed(() => {
  let runningTotal = 0
  const bars = points.value.map((point) => {
    const start = runningTotal
    runningTotal += point.delta
    return {
      ...point,
      start,
      totalAfter: runningTotal
    }
  })

  const maxFractionDigits = bars.reduce<number | null>((current, bar) => {
    if (bar.fractionDigits === null) {
      return current
    }
    if (current === null) {
      return bar.fractionDigits
    }
    return Math.max(current, bar.fractionDigits)
  }, null)

  return {
    bars,
    total: runningTotal,
    maxFractionDigits
  }
})

const categories = computed(() => [
  ...breakdown.value.bars.map((item) => item.label),
  'Total'
])
const baseSeries = computed(() => [...breakdown.value.bars.map((item) => item.start), 0])
const deltaSeries = computed(() => [
  ...breakdown.value.bars.map((item) => item.delta),
  breakdown.value.total
])

const hasData = computed(() => breakdown.value.bars.length > 0)

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow'
    },
    formatter: (params: Array<{ dataIndex: number }>) => {
      const first = params[0]
      if (!first) {
        return ''
      }
      const index = first.dataIndex

      if (index >= breakdown.value.bars.length) {
        return `Total: ${formatTooltipValueWithDigits(breakdown.value.total, breakdown.value.maxFractionDigits)}`
      }

      const bar = breakdown.value.bars[index]
      if (!bar) {
        return ''
      }
      const sign = bar.delta >= 0 ? '+' : ''
      return [
        `${bar.label}`,
        `Delta: ${sign}${formatTooltipValue(bar.delta, bar.rawDelta, breakdown.value.maxFractionDigits)}`,
        `Running total: ${formatTooltipValueWithDigits(bar.totalAfter, breakdown.value.maxFractionDigits)}`
      ].join('<br/>')
    }
  },
  legend: {
    show: showLegend.value,
    top: 0,
    textStyle: { color: '#4b5563' }
  },
  grid: {
    left: 12,
    right: 12,
    top: showLegend.value ? 40 : 12,
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
  series: [
    {
      name: 'Base',
      type: 'bar',
      stack: 'total',
      data: baseSeries.value,
      silent: true,
      itemStyle: {
        color: 'transparent'
      },
      emphasis: {
        disabled: true
      }
    },
    {
      name: 'Delta',
      type: 'bar',
      stack: 'total',
      data: deltaSeries.value,
      itemStyle: {
        borderRadius: barBorderRadius.value,
        color: (params: { dataIndex: number }) => {
          if (params.dataIndex >= breakdown.value.bars.length) {
            return totalColor.value
          }
          const bar = breakdown.value.bars[params.dataIndex]
          return bar && bar.delta < 0 ? negativeColor.value : positiveColor.value
        }
      },
      label: {
        show: true,
        position: 'top',
        color: '#374151',
        formatter: (params: { dataIndex: number }) => {
          if (params.dataIndex >= breakdown.value.bars.length) {
            return formatTooltipValueWithDigits(breakdown.value.total, breakdown.value.maxFractionDigits)
          }
          const bar = breakdown.value.bars[params.dataIndex]
          if (!bar) {
            return ''
          }
          const sign = bar.delta >= 0 ? '+' : ''
          return `${sign}${formatTooltipValue(bar.delta, bar.rawDelta, breakdown.value.maxFractionDigits)}`
        }
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
      No waterfall chart data available yet.
    </p>
    <div v-else class="h-full min-h-[220px]">
      <EChart :option="chartOption" height="100%" />
    </div>
  </div>
</template>
