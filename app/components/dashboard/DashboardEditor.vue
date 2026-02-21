<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'

const props = defineProps<{
  modules: ModuleConfig[]
  selectedModuleId?: string | null
}>()

const emit = defineEmits<{
  (event: 'select', moduleId: string): void
  (event: 'patch', payload: { id: string; changes: Partial<ModuleConfig> }): void
}>()

const moduleStyle = (module: ModuleConfig) => ({
  gridColumn: `${module.gridX + 1} / span ${module.gridW}`,
  gridRow: `${module.gridY + 1} / span ${module.gridH}`
})

const patchLayout = (
  module: ModuleConfig,
  changes: Partial<Pick<ModuleConfig, 'gridX' | 'gridY' | 'gridW' | 'gridH'>>
) => {
  const maxGridX = 11
  const maxGridW = 12
  const maxGridH = 12

  const nextGridW = Math.min(Math.max(changes.gridW ?? module.gridW, 1), maxGridW)
  const nextGridH = Math.min(Math.max(changes.gridH ?? module.gridH, 1), maxGridH)
  const nextGridX = Math.min(Math.max(changes.gridX ?? module.gridX, 0), maxGridX)
  const nextGridY = Math.max(changes.gridY ?? module.gridY, 0)

  emit('patch', {
    id: module.id,
    changes: {
      gridX: nextGridX,
      gridY: nextGridY,
      gridW: nextGridW,
      gridH: nextGridH
    }
  })
}

const moduleLabel = (module: ModuleConfig) =>
  module.title?.trim() || module.type.replace(/_/g, ' ')
</script>

<template>
  <section class="space-y-4">
    <div class="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Dashboard Canvas</h3>
          <p class="text-xs text-gray-500">12-column layout preview with quick position controls.</p>
        </div>
        <p class="text-xs text-gray-500">{{ modules.length }} modules</p>
      </div>

      <div class="grid auto-rows-[120px] grid-cols-12 gap-3 rounded bg-gray-50 p-3">
        <button
          v-for="module in modules"
          :key="module.id"
          class="flex h-full flex-col justify-between rounded border bg-white p-2 text-left shadow-sm transition"
          :class="selectedModuleId === module.id ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'"
          :style="moduleStyle(module)"
          @click="emit('select', module.id)"
        >
          <div>
            <p class="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ module.type.replace(/_/g, ' ') }}
            </p>
            <p class="mt-1 truncate text-sm font-medium text-gray-900">{{ moduleLabel(module) }}</p>
          </div>

          <div class="space-y-2">
            <p class="text-[11px] text-gray-500">
              x{{ module.gridX }}, y{{ module.gridY }}, w{{ module.gridW }}, h{{ module.gridH }}
            </p>

            <div class="grid grid-cols-4 gap-1">
              <button
                class="rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Move left"
                @click.stop="patchLayout(module, { gridX: module.gridX - 1 })"
              >
                ←
              </button>
              <button
                class="rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Move right"
                @click.stop="patchLayout(module, { gridX: module.gridX + 1 })"
              >
                →
              </button>
              <button
                class="rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Move up"
                @click.stop="patchLayout(module, { gridY: module.gridY - 1 })"
              >
                ↑
              </button>
              <button
                class="rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Move down"
                @click.stop="patchLayout(module, { gridY: module.gridY + 1 })"
              >
                ↓
              </button>
              <button
                class="col-span-2 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Narrower"
                @click.stop="patchLayout(module, { gridW: module.gridW - 1 })"
              >
                W-
              </button>
              <button
                class="col-span-2 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Wider"
                @click.stop="patchLayout(module, { gridW: module.gridW + 1 })"
              >
                W+
              </button>
              <button
                class="col-span-2 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Shorter"
                @click.stop="patchLayout(module, { gridH: module.gridH - 1 })"
              >
                H-
              </button>
              <button
                class="col-span-2 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                title="Taller"
                @click.stop="patchLayout(module, { gridH: module.gridH + 1 })"
              >
                H+
              </button>
            </div>
          </div>
        </button>

        <div
          v-if="!modules.length"
          class="col-span-12 rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        >
          No modules yet. Use the palette to add one.
        </div>
      </div>
    </div>
  </section>
</template>
