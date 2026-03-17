<script setup lang="ts">
import { Pencil, Trash2, GripVertical } from 'lucide-vue-next'
import type { SavedQuery } from '~/types/query'

const props = defineProps<{
  query: SavedQuery
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const formattedDate = computed(() => {
  if (!props.query.updatedAt) return ''
  const date = new Date(props.query.updatedAt)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
})

const handleDragStart = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', props.query.id)
    e.dataTransfer.effectAllowed = 'move'
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
          {{ query.name }}
        </h3>
      </div>
      <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <NuxtLink
          :to="`/admin/queries/${query.id}`"
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Pencil class="h-3.5 w-3.5" />
        </NuxtLink>
        <button
          class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          @click.stop="emit('delete', query.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span
        v-if="query.dataSourceName"
        class="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500"
      >
        {{ query.dataSourceName }}
      </span>
      <span class="shrink-0 text-[11px] text-gray-400">
        {{ formattedDate }}
      </span>
    </div>
  </div>
</template>
