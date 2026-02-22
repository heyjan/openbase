<script setup lang="ts">
import { getModuleMinGridHeight, getModuleMinGridWidth, type ModuleConfig } from '~/types/module'
import ModuleRenderer from '~/components/modules/ModuleRenderer.vue'

defineProps<{
  modules: ModuleConfig[]
}>()

const moduleStyle = (module: ModuleConfig) => ({
  gridColumn: `${Math.max(0, module.gridX) + 1} / span ${Math.max(getModuleMinGridWidth(module.type), module.gridW)}`,
  gridRow: `${Math.max(0, module.gridY) + 1} / span ${Math.max(getModuleMinGridHeight(module.type), module.gridH)}`
})
</script>

<template>
  <div class="grid grid-cols-12 auto-rows-[96px] gap-4">
    <div
      v-for="module in modules"
      :key="module.id"
      :style="moduleStyle(module)"
      class="min-h-0"
    >
      <ModuleRenderer :module="module" />
    </div>
  </div>
</template>
