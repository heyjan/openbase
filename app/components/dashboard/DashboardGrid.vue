<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import ModuleRenderer from '~/components/modules/ModuleRenderer.vue'

defineProps<{
  modules: ModuleConfig[]
}>()

const moduleStyle = (module: ModuleConfig) => ({
  gridColumn: `${module.gridX + 1} / span ${module.gridW}`,
  gridRow: `${module.gridY + 1} / span ${module.gridH}`
})
</script>

<template>
  <div class="grid auto-rows-min grid-cols-12 gap-4">
    <div
      v-for="module in modules"
      :key="module.id"
      :style="moduleStyle(module)"
    >
      <ModuleRenderer :module="module" />
    </div>
  </div>
</template>
