<script setup lang="ts">
import { Copy, Link, Trash2 } from 'lucide-vue-next'
import type { ModuleConfig } from '~/types/module'
import ModuleRenderer from '~/components/modules/ModuleRenderer.vue'

const props = defineProps<{
  module: ModuleConfig
  selected?: boolean
}>()

const emit = defineEmits<{
  (event: 'select'): void
  (event: 'delete'): void
  (event: 'duplicate'): void
  (event: 'edit-query'): void
}>()

const moduleLabel = computed(
  () => props.module.title?.trim() || props.module.type.replace(/_/g, ' ')
)
const contentError = ref('')

onErrorCaptured((error) => {
  contentError.value =
    error instanceof Error ? error.message : 'Failed to render module content'
  return false
})
</script>

<template>
  <div
    class="relative h-full overflow-hidden rounded border bg-white shadow-sm"
    :class="selected ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'"
    @click.stop="emit('select')"
  >
    <div class="module-drag-handle flex cursor-move items-start justify-between gap-2 border-b border-gray-100 bg-white/95 px-3 py-2">
      <div class="min-w-0 select-none">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {{ module.type.replace(/_/g, ' ') }}
        </p>
        <p class="mt-1 truncate text-sm font-medium text-gray-900">{{ moduleLabel }}</p>
      </div>

      <div
        v-if="selected"
        class="flex items-center gap-1 rounded border border-gray-200 bg-white p-1 shadow"
      >
        <button
          class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
          title="Edit query"
          @click.stop="emit('edit-query')"
        >
          <Link class="h-3.5 w-3.5" />
        </button>
        <button
          class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
          title="Duplicate module"
          @click.stop="emit('duplicate')"
        >
          <Copy class="h-3.5 w-3.5" />
        </button>
        <button
          class="rounded border border-red-200 p-1 text-red-700 hover:border-red-300"
          title="Delete module"
          @click.stop="emit('delete')"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div class="h-[calc(100%-58px)] overflow-auto p-3">
      <p v-if="contentError" class="text-xs text-red-600">
        {{ contentError }}
      </p>
      <ModuleRenderer v-else :module="module" embedded />
    </div>
  </div>
</template>
