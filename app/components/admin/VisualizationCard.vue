<script setup lang="ts">
import { GripVertical, Pencil, Trash2 } from 'lucide-vue-next'
import type { QueryVisualization } from '~/types/query-visualization'

const props = defineProps<{
  visualization: QueryVisualization
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const formattedDate = computed(() => {
  if (!props.visualization.updatedAt) return ''
  const date = new Date(props.visualization.updatedAt)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.toLocaleDateString('en-US', { day: '2-digit' })
  const year = date.toLocaleDateString('en-US', { year: '2-digit' })
  return `${month} ${day}, '${year}`
})

const moduleTypeLabel = computed(() => props.visualization.moduleType.replace(/_/g, ' '))

const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.visualization.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}
</script>

<template>
  <div
    draggable="true"
    class="group cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    @dragstart="handleDragStart"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1.5">
        <GripVertical class="h-3.5 w-3.5 shrink-0 text-gray-300" />
        <h3 class="truncate text-sm font-medium text-gray-900">
          {{ visualization.name }}
        </h3>
      </div>
      <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <NuxtLink
          :to="`/admin/queries/${visualization.savedQueryId}`"
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Pencil class="h-3.5 w-3.5" />
        </NuxtLink>
        <button
          class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          @click.stop="emit('delete', visualization.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0 flex items-center gap-1.5">
        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
          {{ moduleTypeLabel }}
        </span>
        <span class="text-[11px] text-gray-300">•</span>
        <span class="truncate text-[11px] text-gray-500">
          {{ visualization.savedQueryName }}
        </span>
      </div>
      <span class="shrink-0 text-[11px] text-gray-400">
        {{ formattedDate }}
      </span>
    </div>
  </div>
</template>
