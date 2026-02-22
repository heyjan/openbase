<script setup lang="ts">
import {
  Heading,
  LayoutTemplate,
  Loader2,
  Plus,
  Save,
  StretchHorizontal,
  Type,
  UnfoldHorizontal
} from 'lucide-vue-next'
import type { QueryVisualization } from '~/types/query-visualization'

type CanvasWidthMode = 'fixed' | 'full'

const props = withDefaults(
  defineProps<{
    widthMode: CanvasWidthMode
    layoutDirty?: boolean
    savingLayout?: boolean
    addingVisualization?: boolean
  }>(),
  {
    layoutDirty: false,
    savingLayout: false,
    addingVisualization: false
  }
)

const emit = defineEmits<{
  (event: 'add-query'): void
  (event: 'add-visualization', visualization: QueryVisualization): void
  (event: 'add-header'): void
  (event: 'add-subheader'): void
  (event: 'toggle-width'): void
  (event: 'save-layout'): void
}>()

const { list } = useQueryVisualizations()

const visualizations = ref<QueryVisualization[]>([])
const loadingVisualizations = ref(false)
const visualizationError = ref('')
const visualizationPickerOpen = ref(false)
const selectedVisualizationId = ref('')

const selectedVisualization = computed(() =>
  visualizations.value.find((item) => item.id === selectedVisualizationId.value) ?? null
)

const loadVisualizations = async () => {
  loadingVisualizations.value = true
  visualizationError.value = ''
  try {
    visualizations.value = await list()
  } catch (error) {
    visualizationError.value =
      error instanceof Error ? error.message : 'Failed to load visualizations'
  } finally {
    loadingVisualizations.value = false
  }
}

const toggleVisualizationPicker = () => {
  visualizationPickerOpen.value = !visualizationPickerOpen.value
}

const addFromVisualization = () => {
  if (!selectedVisualization.value) {
    return
  }
  emit('add-visualization', selectedVisualization.value)
  visualizationPickerOpen.value = false
}

onMounted(loadVisualizations)
</script>

<template>
  <div class="rounded border border-gray-200 bg-white p-3 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="solid"
          size="sm"
          class="inline-flex items-center gap-2"
          @click="emit('add-query')"
        >
          <Plus class="h-4 w-4" />
          Add Query
        </UButton>

        <div class="relative">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="inline-flex items-center gap-2"
            @click="toggleVisualizationPicker"
          >
            <LayoutTemplate class="h-4 w-4" />
            Add Visualization
          </UButton>

          <div
            v-if="visualizationPickerOpen"
            class="absolute left-0 top-12 z-20 w-80 rounded border border-gray-200 bg-white p-3 shadow-lg"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-600">Query visualization</p>
            <p v-if="loadingVisualizations" class="mt-2 text-xs text-gray-500">Loading visualizations...</p>
            <p v-else-if="visualizationError" class="mt-2 text-xs text-red-600">{{ visualizationError }}</p>
            <p v-else-if="!visualizations.length" class="mt-2 text-xs text-gray-500">No visualizations yet.</p>

            <template v-else>
              <select
                v-model="selectedVisualizationId"
                class="mt-2 w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">Select visualization...</option>
                <option
                  v-for="visualization in visualizations"
                  :key="visualization.id"
                  :value="visualization.id"
                >
                  {{ visualization.name }} ({{ visualization.moduleType.replace(/_/g, ' ') }} • {{ visualization.savedQueryName }})
                </option>
              </select>

              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                class="mt-2 inline-flex items-center gap-2"
                :disabled="!selectedVisualization || addingVisualization"
                @click="addFromVisualization"
              >
                <Loader2 v-if="addingVisualization" class="h-4 w-4 animate-spin" />
                {{ addingVisualization ? 'Adding...' : 'Add to canvas' }}
              </UButton>
            </template>
          </div>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          square
          title="Add Header"
          aria-label="Add Header"
          @click="emit('add-header')"
        >
          <Heading class="h-4 w-4" />
        </UButton>

        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          square
          title="Add Subheader"
          aria-label="Add Subheader"
          @click="emit('add-subheader')"
        >
          <Type class="h-4 w-4" />
        </UButton>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-2"
          @click="emit('toggle-width')"
        >
          <component
            :is="widthMode === 'fixed' ? StretchHorizontal : UnfoldHorizontal"
            class="h-4 w-4"
          />
          {{ widthMode === 'fixed' ? '1200px' : 'Full width' }}
        </UButton>

        <UButton
          v-if="layoutDirty"
          color="neutral"
          variant="solid"
          size="sm"
          class="inline-flex items-center gap-2"
          :disabled="savingLayout"
          @click="emit('save-layout')"
        >
          <Save class="h-4 w-4" />
          {{ savingLayout ? 'Saving layout...' : 'Save layout' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
