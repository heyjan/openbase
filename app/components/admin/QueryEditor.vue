<script setup lang="ts">
import QueryPreviewResult from '~/components/admin/QueryPreviewResult.vue'
import type { DataSource } from '~/types/data-source'
import type { SavedQueryPreviewResult } from '~/types/query'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
}

type QueryPreviewVisualization = 'table' | 'line' | 'area' | 'bar' | 'pie'

type SaveVisualizationPayload = {
  name: string
  visualization: QueryPreviewVisualization
}

const props = defineProps<{
  value: QueryEditorValue
  dataSources: DataSource[]
  saving?: boolean
  previewing?: boolean
  canPreview?: boolean
  previewResult?: SavedQueryPreviewResult | null
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:value', value: QueryEditorValue): void
  (event: 'save'): void
  (event: 'preview'): void
  (event: 'save-visualization', payload: SaveVisualizationPayload): void
}>()

const visualizationMenuOpen = ref(false)
const selectedVisualization = ref<QueryPreviewVisualization>('table')
const visualizationDraftName = ref('')

const visualizationLabel: Record<QueryPreviewVisualization, string> = {
  table: 'Table',
  line: 'Line Chart',
  area: 'Area Chart',
  bar: 'Bar Chart',
  pie: 'Pie Chart'
}

const updateValue = <K extends keyof QueryEditorValue>(
  key: K,
  value: QueryEditorValue[K]
) => {
  emit('update:value', {
    ...props.value,
    [key]: value
  })
}

const onSelectInput = (event: Event, key: keyof QueryEditorValue) => {
  const target = event.target as HTMLSelectElement | null
  updateValue(key, target?.value ?? '')
}

const onTextInput = (event: Event, key: keyof QueryEditorValue) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
  updateValue(key, target?.value ?? '')
}

const toggleVisualizationMenu = () => {
  if (!props.previewResult) {
    return
  }
  visualizationMenuOpen.value = !visualizationMenuOpen.value
}

const saveVisualization = () => {
  const queryName = props.value.name.trim() || 'Query'
  const fallbackName = `${queryName} ${visualizationLabel[selectedVisualization.value]}`
  const name = visualizationDraftName.value.trim() || fallbackName
  visualizationDraftName.value = name
  emit('save-visualization', {
    name,
    visualization: selectedVisualization.value
  })
}

watch(
  () => props.previewResult,
  (result) => {
    if (!result) {
      visualizationMenuOpen.value = false
      selectedVisualization.value = 'table'
      visualizationDraftName.value = ''
    }
  }
)
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div class="grid gap-4 md:grid-cols-2">
      <label class="block text-sm font-medium text-gray-700">
        Name
        <input
          :value="value.name"
          type="text"
          class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          @input="onTextInput($event, 'name')"
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Data source
        <select
          :value="value.dataSourceId"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          @change="onSelectInput($event, 'dataSourceId')"
        >
          <option disabled value="">Select data source</option>
          <option
            v-for="source in dataSources"
            :key="source.id"
            :value="source.id"
          >
            {{ source.name }} ({{ source.type }})
          </option>
        </select>
      </label>
    </div>

    <label class="mt-4 block text-sm font-medium text-gray-700">
      Description
      <input
        :value="value.description"
        type="text"
        class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        @input="onTextInput($event, 'description')"
      />
    </label>

    <label class="mt-4 block text-sm font-medium text-gray-700">
      Query text
      <textarea
        :value="value.queryText"
        :rows="10"
        class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-xs"
        @input="onTextInput($event, 'queryText')"
      />
    </label>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <UButton
        color="neutral"
        variant="solid"
        size="sm"
        :disabled="saving"
        @click="emit('save')"
      >
        {{ saving ? 'Saving...' : 'Save query' }}
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="previewing || saving || !canPreview"
        @click="emit('preview')"
      >
        {{ previewing ? 'Running...' : 'Run preview' }}
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!previewResult"
        @click="toggleVisualizationMenu"
      >
        {{ visualizationMenuOpen ? 'Hide visualizations' : 'Visualizations' }}
      </UButton>
      <input
        v-if="previewResult"
        v-model="visualizationDraftName"
        type="text"
        class="min-w-52 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        placeholder="Visualization name"
      />
      <UButton
        v-if="previewResult"
        color="neutral"
        variant="outline"
        size="sm"
        @click="saveVisualization"
      >
        Save visualization
      </UButton>
      <p v-if="!canPreview" class="text-xs text-gray-500">
        Name, data source, and query text are required to run preview.
      </p>
    </div>

    <p v-if="errorMessage" class="mt-3 text-sm text-red-600">{{ errorMessage }}</p>

    <QueryPreviewResult
      v-if="previewResult"
      :result="previewResult"
      :show-visualization-menu="visualizationMenuOpen"
      :visualization="selectedVisualization"
      @update:visualization="selectedVisualization = $event"
    />
  </section>
</template>
