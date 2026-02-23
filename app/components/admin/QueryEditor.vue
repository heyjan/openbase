<script setup lang="ts">
import QueryPreviewResult from '~/components/admin/QueryPreviewResult.vue'
import type { DataSource } from '~/types/data-source'
import type { SavedQueryPreviewResult } from '~/types/query'
import {
  extractVariables,
  parseVariableDefinitions,
  type VariableDefinition,
  type VariableType
} from '~~/shared/utils/query-variables'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
}

type QueryPreviewVisualization = 'table' | 'line' | 'area' | 'bar' | 'pie' | 'scatter'

type SaveVisualizationPayload = {
  name: string
  visualization: QueryPreviewVisualization
}

type SavedQueryOption = {
  id: string
  name: string
}

const props = defineProps<{
  value: QueryEditorValue
  dataSources: DataSource[]
  queryParameters?: Record<string, unknown>
  savedQueries?: SavedQueryOption[]
  currentQueryId?: string
  previewParameters?: Record<string, unknown>
  saving?: boolean
  previewing?: boolean
  canPreview?: boolean
  previewResult?: SavedQueryPreviewResult | null
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'update:value', value: QueryEditorValue): void
  (event: 'update:query-parameters', value: Record<string, unknown>): void
  (event: 'update:preview-parameters', value: Record<string, unknown>): void
  (event: 'save'): void
  (event: 'preview'): void
  (event: 'save-visualization', payload: SaveVisualizationPayload): void
}>()

const { preview } = useQueries()

const visualizationMenuOpen = ref(false)
const selectedVisualization = ref<QueryPreviewVisualization>('table')
const visualizationDraftName = ref('')

const sourceQueryColumns = reactive<Record<string, string[]>>({})
const sourceQueryErrors = reactive<Record<string, string>>({})
const loadingSourceColumns = reactive<Record<string, boolean>>({})
const loadedSourceQueryByVariable = reactive<Record<string, string>>({})

const visualizationLabel: Record<QueryPreviewVisualization, string> = {
  table: 'Table',
  line: 'Line Chart',
  area: 'Area Chart',
  bar: 'Bar Chart',
  pie: 'Pie Chart',
  scatter: 'Scatter Chart'
}

const variableTypeOptions: Array<{ value: VariableType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'query_list', label: 'Query list' }
]

const detectedVariables = computed(() => extractVariables(props.value.queryText))

const parseDefinitionsSafe = (parameters: unknown) => {
  try {
    return parseVariableDefinitions(parameters)
  } catch {
    return [] as VariableDefinition[]
  }
}

const normalizedDefinition = (definition: VariableDefinition) => ({
  name: definition.name,
  label: definition.label?.trim() || undefined,
  type: definition.type ?? 'text',
  required: definition.required === true,
  defaultValue:
    definition.defaultValue === undefined ? undefined : definition.defaultValue,
  sourceQueryId: definition.sourceQueryId?.trim() || undefined,
  valueColumn: definition.valueColumn?.trim() || undefined,
  labelColumn: definition.labelColumn?.trim() || undefined,
  options: definition.options ?? []
})

const definitionsEqual = (left: VariableDefinition[], right: VariableDefinition[]) =>
  JSON.stringify(left.map(normalizedDefinition)) ===
  JSON.stringify(right.map(normalizedDefinition))

const variableDefinitions = computed<VariableDefinition[]>(() => {
  const existing = parseDefinitionsSafe(props.queryParameters ?? {})
  const mapByName = new Map(existing.map((definition) => [definition.name, definition]))

  return detectedVariables.value.map((name) => {
    const matched = mapByName.get(name)
    return {
      name,
      label: matched?.label,
      type: matched?.type ?? 'text',
      required: matched?.required ?? false,
      defaultValue: matched?.defaultValue,
      options: matched?.options,
      sourceQueryId: matched?.sourceQueryId,
      valueColumn: matched?.valueColumn,
      labelColumn: matched?.labelColumn
    }
  })
})

const sourceQueryOptions = computed(() =>
  (props.savedQueries ?? []).filter((query) => query.id !== props.currentQueryId)
)

const emitQueryParameters = (definitions: VariableDefinition[]) => {
  const current = props.queryParameters ?? {}
  const next = { ...current }

  if (definitions.length) {
    next.variables = definitions
  } else {
    delete next.variables
  }

  emit('update:query-parameters', next)
}

const syncDefinitionsToDetectedVariables = () => {
  const existing = parseDefinitionsSafe(props.queryParameters ?? {})
  const merged = variableDefinitions.value

  if (!definitionsEqual(existing, merged)) {
    emitQueryParameters(merged)
  }
}

const updateVariableDefinition = (
  variableName: string,
  updater: (definition: VariableDefinition) => VariableDefinition
) => {
  const next = variableDefinitions.value.map((definition) =>
    definition.name === variableName ? updater(definition) : definition
  )
  emitQueryParameters(next)
}

const onVariableTextInput = (
  event: Event,
  variableName: string,
  key: 'label' | 'defaultValue' | 'sourceQueryId' | 'valueColumn' | 'labelColumn'
) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  const value = target?.value ?? ''

  updateVariableDefinition(variableName, (definition) => ({
    ...definition,
    [key]: value.trim() ? value : undefined
  }))
}

const onVariableRequiredChange = (event: Event, variableName: string) => {
  const target = event.target as HTMLInputElement | null

  updateVariableDefinition(variableName, (definition) => ({
    ...definition,
    required: target?.checked === true
  }))
}

const onVariableTypeChange = (event: Event, variableName: string) => {
  const target = event.target as HTMLSelectElement | null
  const value = (target?.value ?? 'text') as VariableType

  updateVariableDefinition(variableName, (definition) => {
    const next: VariableDefinition = {
      ...definition,
      type: value
    }

    if (value !== 'query_list') {
      next.sourceQueryId = undefined
      next.valueColumn = undefined
      next.labelColumn = undefined
    }

    return next
  })
}

const loadSourceColumns = async (variableName: string, sourceQueryId: string) => {
  if (!sourceQueryId.trim()) {
    sourceQueryColumns[variableName] = []
    sourceQueryErrors[variableName] = ''
    loadedSourceQueryByVariable[variableName] = ''
    return
  }

  if (
    loadedSourceQueryByVariable[variableName] === sourceQueryId &&
    Array.isArray(sourceQueryColumns[variableName])
  ) {
    return
  }

  loadingSourceColumns[variableName] = true
  sourceQueryErrors[variableName] = ''

  try {
    const result = await preview(sourceQueryId, { limit: 1 })
    sourceQueryColumns[variableName] = result.columns
    loadedSourceQueryByVariable[variableName] = sourceQueryId
  } catch (error) {
    sourceQueryColumns[variableName] = []
    sourceQueryErrors[variableName] =
      error instanceof Error ? error.message : 'Failed to load source query columns'
  } finally {
    loadingSourceColumns[variableName] = false
  }
}

const areParameterMapsEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
) => {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }
    if (left[key] !== right[key]) {
      return false
    }
  }
  return true
}

const normalizePreviewParameters = () => {
  const current = props.previewParameters ?? {}
  const next: Record<string, unknown> = {}
  for (const variable of detectedVariables.value) {
    if (Object.prototype.hasOwnProperty.call(current, variable)) {
      next[variable] = current[variable]
      continue
    }
    next[variable] = ''
  }
  if (!areParameterMapsEqual(current, next)) {
    emit('update:preview-parameters', next)
  }
}

const updatePreviewParameter = (variable: string, value: string) => {
  const next: Record<string, unknown> = {}
  const current = props.previewParameters ?? {}
  for (const name of detectedVariables.value) {
    if (name === variable) {
      next[name] = value
      continue
    }
    next[name] = Object.prototype.hasOwnProperty.call(current, name) ? current[name] : ''
  }
  emit('update:preview-parameters', next)
}

const onPreviewParameterInput = (event: Event, variable: string) => {
  const target = event.target as HTMLInputElement | null
  updatePreviewParameter(variable, target?.value ?? '')
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

watch(
  [detectedVariables, () => props.previewParameters],
  () => {
    normalizePreviewParameters()
  },
  { immediate: true, deep: true }
)

watch(
  [detectedVariables, () => props.queryParameters],
  () => {
    syncDefinitionsToDetectedVariables()
  },
  { immediate: true, deep: true }
)

watch(
  variableDefinitions,
  (definitions) => {
    const active = new Set(definitions.map((definition) => definition.name))

    for (const key of Object.keys(sourceQueryColumns)) {
      if (!active.has(key)) {
        delete sourceQueryColumns[key]
        delete sourceQueryErrors[key]
        delete loadingSourceColumns[key]
        delete loadedSourceQueryByVariable[key]
      }
    }

    for (const definition of definitions) {
      if (definition.type !== 'query_list') {
        continue
      }
      if (!definition.sourceQueryId) {
        sourceQueryColumns[definition.name] = []
        sourceQueryErrors[definition.name] = ''
        loadedSourceQueryByVariable[definition.name] = ''
        continue
      }
      loadSourceColumns(definition.name, definition.sourceQueryId)
    }
  },
  { immediate: true, deep: true }
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

    <div
      v-if="detectedVariables.length"
      class="mt-4 rounded border border-gray-200 bg-gray-50 p-3"
    >
      <p class="text-sm font-medium text-gray-700">Variable configuration</p>
      <p class="mt-1 text-xs text-gray-500">
        Define variable type and source query for dashboard dropdown filters.
      </p>

      <div class="mt-3 space-y-3">
        <div
          v-for="definition in variableDefinitions"
          :key="`definition-${definition.name}`"
          class="rounded border border-gray-200 bg-white p-3"
        >
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Variable
              <input
                :value="definition.name"
                type="text"
                disabled
                class="mt-1 w-full rounded border border-gray-200 bg-gray-100 px-3 py-2 text-sm normal-case tracking-normal text-gray-600"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Label
              <input
                :value="definition.label ?? ''"
                type="text"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @input="onVariableTextInput($event, definition.name, 'label')"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Type
              <select
                :value="definition.type ?? 'text'"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @change="onVariableTypeChange($event, definition.name)"
              >
                <option
                  v-for="option in variableTypeOptions"
                  :key="`${definition.name}-type-${option.value}`"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Default value
              <input
                :value="definition.defaultValue === undefined || definition.defaultValue === null ? '' : String(definition.defaultValue)"
                type="text"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @input="onVariableTextInput($event, definition.name, 'defaultValue')"
              />
            </label>
          </div>

          <label class="mt-3 inline-flex items-center gap-2 text-xs font-medium text-gray-700">
            <input
              :checked="definition.required === true"
              type="checkbox"
              class="h-4 w-4 rounded border border-gray-300"
              @change="onVariableRequiredChange($event, definition.name)"
            />
            Require a value
          </label>

          <div
            v-if="definition.type === 'query_list'"
            class="mt-3 grid gap-3 md:grid-cols-3"
          >
            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Source query
              <select
                :value="definition.sourceQueryId ?? ''"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @change="onVariableTextInput($event, definition.name, 'sourceQueryId')"
              >
                <option value="">Select query</option>
                <option
                  v-for="query in sourceQueryOptions"
                  :key="`source-${definition.name}-${query.id}`"
                  :value="query.id"
                >
                  {{ query.name }}
                </option>
              </select>
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Value column
              <select
                :value="definition.valueColumn ?? ''"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @change="onVariableTextInput($event, definition.name, 'valueColumn')"
              >
                <option value="">Select column</option>
                <option
                  v-for="column in sourceQueryColumns[definition.name] ?? []"
                  :key="`value-column-${definition.name}-${column}`"
                  :value="column"
                >
                  {{ column }}
                </option>
              </select>
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Label column
              <select
                :value="definition.labelColumn ?? ''"
                class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
                @change="onVariableTextInput($event, definition.name, 'labelColumn')"
              >
                <option value="">Use value column</option>
                <option
                  v-for="column in sourceQueryColumns[definition.name] ?? []"
                  :key="`label-column-${definition.name}-${column}`"
                  :value="column"
                >
                  {{ column }}
                </option>
              </select>
            </label>

            <p
              v-if="loadingSourceColumns[definition.name]"
              class="md:col-span-3 text-xs text-gray-500"
            >
              Loading source query columns...
            </p>
            <p
              v-else-if="sourceQueryErrors[definition.name]"
              class="md:col-span-3 text-xs text-red-600"
            >
              {{ sourceQueryErrors[definition.name] }}
            </p>
          </div>
        </div>
      </div>

      <p class="mt-4 text-sm font-medium text-gray-700">Preview variables</p>
      <p class="mt-1 text-xs text-gray-500">
        Provide values for detected variables before running preview.
      </p>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label
          v-for="variable in detectedVariables"
          :key="`preview-${variable}`"
          class="block text-xs font-medium uppercase tracking-wide text-gray-600"
        >
          {{ variable }}
          <input
            :value="String((previewParameters ?? {})[variable] ?? '')"
            type="text"
            class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal"
            @input="onPreviewParameterInput($event, variable)"
          />
        </label>
      </div>
    </div>

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
