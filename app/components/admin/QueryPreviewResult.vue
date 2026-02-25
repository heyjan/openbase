<script setup lang="ts">
import { Table2, TrendingUp, AreaChart, BarChart3, PieChart, ScatterChart } from 'lucide-vue-next'
import type { EChartsOption } from 'echarts'
import EChart from '~/components/charts/EChart.vue'
import Table from '~/components/ui/Table.vue'
import type { SavedQueryPreviewResult } from '~/types/query'

type QueryPreviewVisualization = 'table' | 'line' | 'area' | 'bar' | 'pie' | 'scatter'

type VisualizationOption = {
  id: QueryPreviewVisualization
  label: string
  description: string
  icon: ReturnType<typeof defineComponent>
}

const props = defineProps<{
  result: SavedQueryPreviewResult
  visualization: QueryPreviewVisualization
  showVisualizationMenu: boolean
}>()

const emit = defineEmits<{
  (event: 'update:visualization', value: QueryPreviewVisualization): void
}>()

const visualizationOptions: VisualizationOption[] = [
  {
    id: 'table',
    label: 'Table',
    description: 'Raw rows and columns',
    icon: Table2
  },
  {
    id: 'line',
    label: 'Line Chart',
    description: 'Trend over category axis',
    icon: TrendingUp
  },
  {
    id: 'area',
    label: 'Area Chart',
    description: 'Line chart with filled area',
    icon: AreaChart
  },
  {
    id: 'bar',
    label: 'Bar Chart',
    description: 'Compare values by category',
    icon: BarChart3
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    description: 'Distribution by category',
    icon: PieChart
  },
  {
    id: 'scatter',
    label: 'Scatter',
    description: 'Relationship between numeric fields',
    icon: ScatterChart
  }
]

const palette = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']
const rows = computed(() => props.result.rows ?? [])
const columns = computed(() => props.result.columns ?? [])
const tableRows = computed(() => rows.value)
const tableColumns = computed(() =>
  columns.value.map((column) => ({
    key: column,
    label: column
  }))
)

const activeVisualizationLabel = computed(
  () => visualizationOptions.find((item) => item.id === props.visualization)?.label ?? 'Table'
)

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
const categoryColumns = computed(() => {
  const dimensions = columns.value.filter((column) => !numericColumns.value.includes(column))
  return dimensions.length ? dimensions : columns.value
})

const primaryCategoryColumn = computed(() => categoryColumns.value[0] ?? '')

const seriesColumns = computed(() => {
  const withoutCategory = numericColumns.value.filter(
    (column) => column !== primaryCategoryColumn.value
  )
  const selected = withoutCategory.length ? withoutCategory : numericColumns.value
  return selected.slice(0, 4)
})

const categories = computed(() => {
  const useRowIndex =
    !primaryCategoryColumn.value || numericColumns.value.includes(primaryCategoryColumn.value)

  return rows.value.map((row, index) => {
    if (useRowIndex) {
      return String(index + 1)
    }
    return String(row[primaryCategoryColumn.value] ?? index + 1)
  })
})

const pieCategoryColumn = computed(() => categoryColumns.value[0] ?? columns.value[0] ?? '')
const pieValueColumn = computed(
  () =>
    numericColumns.value.find((column) => column !== pieCategoryColumn.value) ??
    numericColumns.value[0] ??
    ''
)

const pieData = computed(() => {
  if (!pieCategoryColumn.value || !pieValueColumn.value) {
    return [] as Array<{ name: string; value: number }>
  }

  const totals = new Map<string, number>()
  for (const row of rows.value) {
    const name = String(row[pieCategoryColumn.value] ?? '').trim() || 'Unknown'
    const value = toNumber(row[pieValueColumn.value])
    if (value === null) {
      continue
    }
    totals.set(name, (totals.get(name) ?? 0) + value)
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
})

const hasCartesianData = computed(() => rows.value.length > 0 && seriesColumns.value.length > 0)
const hasPieData = computed(() => pieData.value.length > 0)

const scatterXColumn = computed(() => numericColumns.value[0] ?? '')
const scatterYColumn = computed(
  () => numericColumns.value.find((column) => column !== scatterXColumn.value) ?? ''
)
const scatterSizeColumn = computed(
  () =>
    numericColumns.value.find(
      (column) => column !== scatterXColumn.value && column !== scatterYColumn.value
    ) ?? scatterYColumn.value
)
const scatterLabelColumn = computed(() => categoryColumns.value[0] ?? '')

const scatterData = computed(() => {
  if (!scatterXColumn.value || !scatterYColumn.value || !scatterSizeColumn.value) {
    return [] as Array<{ value: [number, number, number]; name?: string }>
  }

  return rows.value
    .map((row) => {
      const x = toNumber(row[scatterXColumn.value])
      const y = toNumber(row[scatterYColumn.value])
      const size = toNumber(row[scatterSizeColumn.value])

      if (x === null || y === null || size === null) {
        return null
      }

      const label =
        scatterLabelColumn.value &&
        row[scatterLabelColumn.value] !== null &&
        row[scatterLabelColumn.value] !== undefined
          ? String(row[scatterLabelColumn.value]).trim()
          : ''

      return {
        value: [x, y, size] as [number, number, number],
        name: label || undefined
      }
    })
    .filter((item): item is { value: [number, number, number]; name?: string } => item !== null)
})

const scatterSizeExtent = computed(() => {
  const sizes = scatterData.value.map((item) => item.value[2])
  if (!sizes.length) {
    return { min: 0, max: 0 }
  }
  return {
    min: Math.min(...sizes),
    max: Math.max(...sizes)
  }
})

const scaleScatterSymbolSize = (value: unknown) => {
  if (!Array.isArray(value)) {
    return 10
  }

  const rawSize = Number(value[2])
  if (!Number.isFinite(rawSize)) {
    return 10
  }

  const span = scatterSizeExtent.value.max - scatterSizeExtent.value.min
  if (span <= 0) {
    return 24
  }

  const ratio = (rawSize - scatterSizeExtent.value.min) / span
  const clamped = Math.max(0, Math.min(1, ratio))
  return 10 + clamped * 32
}

const hasScatterData = computed(() => scatterData.value.length > 0)

const chartOption = computed<EChartsOption>(() => {
  if (props.visualization === 'pie') {
    return {
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
          radius: ['35%', '70%'],
          center: ['50%', '42%'],
          data: pieData.value,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2
          },
          label: { color: '#374151' }
        }
      ]
    }
  }

  if (props.visualization === 'scatter') {
    return {
      tooltip: {
        trigger: 'item'
      },
      grid: {
        left: 12,
        right: 12,
        top: 18,
        bottom: 28,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: scatterXColumn.value || 'X',
        nameGap: 20,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      yAxis: {
        type: 'value',
        name: scatterYColumn.value || 'Y',
        nameGap: 30,
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: [
        {
          type: 'scatter',
          data: scatterData.value,
          symbolSize: scaleScatterSymbolSize,
          itemStyle: {
            color: '#2563eb',
            opacity: 0.78
          },
          emphasis: {
            focus: 'series'
          }
        }
      ]
    }
  }

  const isBar = props.visualization === 'bar'
  const isArea = props.visualization === 'area'

  return {
    color: palette,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: isBar ? 'shadow' : 'line'
      }
    },
    legend: {
      top: 0,
      textStyle: {
        color: '#4b5563'
      }
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
    series: seriesColumns.value.map((column, index) => ({
      type: isBar ? 'bar' : 'line',
      name: column,
      smooth: !isBar,
      showSymbol: false,
      areaStyle: isArea ? { opacity: 0.18 } : undefined,
      emphasis: {
        focus: 'series'
      },
      itemStyle: {
        color: palette[index % palette.length]
      },
      data: rows.value.map((row) => toNumber(row[column]))
    }))
  }
})
</script>

<template>
  <div class="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
    <div class="flex items-center justify-between text-xs text-gray-500">
      <p>Rows: {{ result.rowCount }} | Columns: {{ result.columns.length }}</p>
      <p class="uppercase tracking-wide text-gray-400">{{ activeVisualizationLabel }}</p>
    </div>

    <div class="mt-3 flex gap-3">
      <aside
        v-if="showVisualizationMenu"
        class="w-56 shrink-0 rounded border border-gray-200 bg-white p-3"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Visualizations
        </p>
        <div class="mt-2 grid gap-1">
          <UButton
            v-for="option in visualizationOptions"
            :key="option.id"
            color="neutral"
            :variant="visualization === option.id ? 'solid' : 'ghost'"
            size="xs"
            class="justify-start text-left"
            :title="option.description"
            @click="emit('update:visualization', option.id)"
          >
            <div class="flex items-center gap-2">
              <component :is="option.icon" class="h-4 w-4 shrink-0" />
              <span class="text-xs font-medium">{{ option.label }}</span>
            </div>
          </UButton>
        </div>
      </aside>

      <div class="min-w-0 flex-1 rounded border border-gray-200 bg-white">
        <div v-if="visualization === 'table'" class="overflow-auto">
          <Table :rows="tableRows" :columns="tableColumns" empty-label="No preview rows found." />
        </div>

        <div v-else class="p-3">
          <p
            v-if="visualization === 'pie'"
            class="mb-2 text-xs text-gray-500"
          >
            Grouping by <span class="font-medium text-gray-700">{{ pieCategoryColumn || 'category' }}</span>
            using <span class="font-medium text-gray-700">{{ pieValueColumn || 'value' }}</span>.
          </p>
          <p
            v-else-if="visualization === 'scatter'"
            class="mb-2 text-xs text-gray-500"
          >
            X: <span class="font-medium text-gray-700">{{ scatterXColumn || 'none' }}</span>
            | Y: <span class="font-medium text-gray-700">{{ scatterYColumn || 'none' }}</span>
            | Size: <span class="font-medium text-gray-700">{{ scatterSizeColumn || 'none' }}</span>
          </p>
          <p
            v-else
            class="mb-2 text-xs text-gray-500"
          >
            X-axis: <span class="font-medium text-gray-700">{{ primaryCategoryColumn || 'row index' }}</span>
            | Series: <span class="font-medium text-gray-700">{{ seriesColumns.join(', ') || 'none' }}</span>
          </p>

          <p
            v-if="visualization === 'pie' && !hasPieData"
            class="text-sm text-gray-500"
          >
            No suitable category/value columns found for pie chart rendering.
          </p>
          <p
            v-else-if="visualization === 'scatter' && !hasScatterData"
            class="text-sm text-gray-500"
          >
            Need at least two numeric columns to render a scatter chart.
          </p>
          <p
            v-else-if="visualization !== 'pie' && visualization !== 'scatter' && !hasCartesianData"
            class="text-sm text-gray-500"
          >
            No numeric series columns found for chart rendering.
          </p>
          <EChart
            v-else
            :option="chartOption"
            height="320px"
          />
        </div>
      </div>
    </div>
  </div>
</template>
