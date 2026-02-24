<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
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
  ScatterChart,
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
const containerSize = reactive({ width: 0, height: 0 })
const fallbackWidth = 320
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null

const parsePixelHeight = (value: string) => {
  if (!value.endsWith('px')) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const initOptions = computed(() => {
  const measuredWidth = containerRef.value?.clientWidth ?? containerSize.width
  const width = Math.max(measuredWidth, fallbackWidth)

  const configuredHeight = parsePixelHeight(props.height)
  const measuredHeight = containerRef.value?.clientHeight ?? containerSize.height
  if (configuredHeight !== null) {
    const height = Math.max(measuredHeight, configuredHeight)
    return { width, height }
  }

  if (measuredHeight > 0) {
    return { width, height: measuredHeight }
  }

  return { width }
})

const canRenderChart = computed(() => {
  const measuredWidth = containerRef.value?.clientWidth ?? containerSize.width
  if (measuredWidth <= 0) {
    return false
  }

  if (parsePixelHeight(props.height) !== null) {
    return true
  }

  const measuredHeight = containerRef.value?.clientHeight ?? containerSize.height
  return measuredHeight > 0
})

const resizeChart = () => {
  if (!process.client) {
    return
  }

  const instance = chartRef.value as
    | (InstanceType<typeof VChart> & {
        resize?: () => void
        chart?: { resize?: () => void; isDisposed?: () => boolean }
      })
    | null
  if (!instance) {
    return
  }

  if (instance.chart?.isDisposed?.()) {
    return
  }

  instance?.resize?.()
  instance?.chart?.resize?.()
}

const queueResize = () => {
  if (!process.client) {
    return
  }

  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame)
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null
    resizeChart()
  })
}

const onExternalGridResize = () => {
  queueResize()
}

onMounted(() => {
  if (!process.client) {
    return
  }

  window.addEventListener('dashboard-grid-resize', onExternalGridResize)

  if (containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      containerSize.width = containerRef.value?.clientWidth ?? 0
      containerSize.height = containerRef.value?.clientHeight ?? 0
      queueResize()
    })
    resizeObserver.observe(containerRef.value)
  }

  containerSize.width = containerRef.value?.clientWidth ?? 0
  containerSize.height = containerRef.value?.clientHeight ?? 0

  nextTick(() => {
    queueResize()
    window.setTimeout(() => {
      queueResize()
    }, 0)
  })
})

onBeforeUnmount(() => {
  if (!process.client) {
    return
  }

  window.removeEventListener('dashboard-grid-resize', onExternalGridResize)

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame)
    resizeFrame = null
  }
})

watch(
  () => props.height,
  () => {
    queueResize()
  }
)

watch(
  () => props.option,
  () => {
    queueResize()
  },
  { deep: true }
)

watch(
  canRenderChart,
  (ready) => {
    if (ready) {
      queueResize()
    }
  },
  { immediate: true }
)

defineExpose({
  chart: chartRef
})
</script>

<template>
  <ClientOnly>
    <div ref="containerRef" class="w-full" :style="{ height: props.height }">
      <VChart
        v-if="canRenderChart"
        ref="chartRef"
        class="h-full w-full"
        :option="props.option"
        :autoresize="props.autoresize"
        :loading="props.loading"
        :init-options="initOptions"
        :style="{ height: '100%' }"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm text-gray-500"
      >
        Loading chart...
      </div>
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
