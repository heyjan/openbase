<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  RadarComponent
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
const tooltipCursorOffset = {
  x: 12,
  y: 16
}

type TooltipPositionSize = {
  contentSize?: number[]
  viewSize?: number[]
}

const parsePixelHeight = (value: string) => {
  if (!value.endsWith('px')) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const defaultTooltipPosition = (
  point: number[] | undefined,
  _params: unknown,
  _dom: HTMLElement,
  _rect: unknown,
  size?: TooltipPositionSize
) => {
  const pointerX = Array.isArray(point) && typeof point[0] === 'number' ? point[0] : 0
  const pointerY = Array.isArray(point) && typeof point[1] === 'number' ? point[1] : 0
  const contentWidth = Math.max(size?.contentSize?.[0] ?? 0, 0)
  const contentHeight = Math.max(size?.contentSize?.[1] ?? 0, 0)
  const viewWidth = Math.max(size?.viewSize?.[0] ?? 0, contentWidth)
  const viewHeight = Math.max(size?.viewSize?.[1] ?? 0, contentHeight)
  const desiredX = pointerX + tooltipCursorOffset.x
  const desiredY = pointerY + tooltipCursorOffset.y

  return [
    clamp(desiredX, 0, Math.max(viewWidth - contentWidth, 0)),
    clamp(desiredY, 0, Math.max(viewHeight - contentHeight, 0))
  ]
}

const applyTooltipDefaults = (tooltip: unknown): unknown => {
  if (Array.isArray(tooltip)) {
    return tooltip.map((entry) => applyTooltipDefaults(entry))
  }

  if (!tooltip || typeof tooltip !== 'object') {
    return tooltip
  }

  const tooltipRecord = tooltip as Record<string, unknown>
  const hasConfine = Object.prototype.hasOwnProperty.call(tooltipRecord, 'confine')
  const hasPosition = Object.prototype.hasOwnProperty.call(tooltipRecord, 'position')

  return {
    ...tooltipRecord,
    confine: hasConfine ? tooltipRecord.confine : true,
    position: hasPosition ? tooltipRecord.position : defaultTooltipPosition
  }
}

const optionWithTooltipDefaults = computed<EChartsOption>(() => {
  const optionRecord = props.option as Record<string, unknown>
  const tooltip = optionRecord.tooltip

  if (tooltip === undefined || tooltip === null || tooltip === false) {
    return props.option
  }

  return {
    ...props.option,
    tooltip: applyTooltipDefaults(tooltip)
  } as EChartsOption
})

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
  optionWithTooltipDefaults,
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
        :option="optionWithTooltipDefaults"
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
