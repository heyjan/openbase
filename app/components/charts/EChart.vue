<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent
])

const props = withDefaults(
  defineProps<{
    option: EChartsOption
    height?: string
    loading?: boolean
    autoresize?: boolean
  }>(),
  {
    height: '260px',
    loading: false,
    autoresize: true
  }
)

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const fallbackWidth = 320
const fallbackHeight = 260

const parsePixelHeight = (value: string) => {
  if (!value.endsWith('px')) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const initOptions = computed(() => {
  const width = Math.max(containerRef.value?.clientWidth ?? 0, fallbackWidth)

  const configuredHeight = parsePixelHeight(props.height)
  const measuredHeight = containerRef.value?.clientHeight ?? 0
  const height = Math.max(measuredHeight, configuredHeight ?? fallbackHeight)

  return { width, height }
})

defineExpose({
  chart: chartRef
})
</script>

<template>
  <ClientOnly>
    <div ref="containerRef" class="w-full" :style="{ height: props.height }">
      <VChart
        ref="chartRef"
        class="h-full w-full"
        :option="props.option"
        :autoresize="props.autoresize"
        :loading="props.loading"
        :init-options="initOptions"
        :style="{ height: '100%' }"
      />
    </div>
    <template #fallback>
      <div
        class="flex w-full items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm text-gray-500"
        :style="{ height: props.height }"
      >
        Loading chart...
      </div>
    </template>
  </ClientOnly>
</template>
