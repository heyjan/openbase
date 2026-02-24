<script setup lang="ts">
import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_GRID_GAP,
  DASHBOARD_GRID_ROW_HEIGHT
} from '~/constants/dashboard-grid'
import { getModuleMinGridHeight, getModuleMinGridWidth, type ModuleConfig } from '~/types/module'
import ModuleRenderer from '~/components/modules/ModuleRenderer.vue'

const props = defineProps<{
  modules: ModuleConfig[]
}>()

const moduleStyle = (module: ModuleConfig) => ({
  gridColumn: `${Math.max(0, module.gridX) + 1} / span ${Math.max(getModuleMinGridWidth(module.type), module.gridW)}`,
  gridRow: `${Math.max(0, module.gridY) + 1} / span ${Math.max(getModuleMinGridHeight(module.type), module.gridH)}`
})

const gridStyle = {
  gridTemplateColumns: `repeat(${DASHBOARD_GRID_COLUMNS}, minmax(0, 1fr))`,
  gridAutoRows: `${DASHBOARD_GRID_ROW_HEIGHT}px`,
  gap: `${DASHBOARD_GRID_GAP}px`
}

let resizeEventFrame: number | null = null

const emitGridResize = () => {
  if (!process.client || resizeEventFrame !== null) {
    return
  }

  resizeEventFrame = window.requestAnimationFrame(() => {
    resizeEventFrame = null
    window.dispatchEvent(new CustomEvent('dashboard-grid-resize'))
    window.dispatchEvent(new Event('resize'))
  })
}

onMounted(() => {
  emitGridResize()
})

watch(
  () =>
    props.modules
      .map((module) => `${module.id}:${module.gridX}:${module.gridY}:${module.gridW}:${module.gridH}`)
      .join('|'),
  () => {
    nextTick(() => {
      emitGridResize()
    })
  }
)

onBeforeUnmount(() => {
  if (!process.client || resizeEventFrame === null) {
    return
  }

  window.cancelAnimationFrame(resizeEventFrame)
  resizeEventFrame = null
})
</script>

<template>
  <div class="grid" :style="gridStyle">
    <div
      v-for="module in modules"
      :key="module.id"
      :style="moduleStyle(module)"
      class="min-h-0 h-full"
    >
      <ModuleRenderer :module="module" />
    </div>
  </div>
</template>
