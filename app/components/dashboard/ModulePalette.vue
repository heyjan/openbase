<script setup lang="ts">
import type { ModuleType } from '~/types/module'
import type { ModuleTemplate } from '~/types/template'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (
    event: 'add',
    payload: { type: ModuleType; template?: ModuleTemplate }
  ): void
}>()

type PaletteItem = {
  type: ModuleType
  label: string
  description: string
}

const items: PaletteItem[] = [
  {
    type: 'kpi_card',
    label: 'KPI Card',
    description: 'Single metric with trend context'
  },
  {
    type: 'line_chart',
    label: 'Line Chart',
    description: 'Classic trend chart for one or more metrics'
  },
  {
    type: 'bar_chart',
    label: 'Bar Chart',
    description: 'Category comparison with grouped or stacked bars'
  },
  {
    type: 'pie_chart',
    label: 'Pie Chart',
    description: 'Distribution breakdown by category'
  },
  {
    type: 'time_series_chart',
    label: 'Time Series',
    description: 'Multi-series line visualization'
  },
  {
    type: 'outlier_table',
    label: 'Outlier Table',
    description: 'Ranked anomalies with status'
  },
  {
    type: 'data_table',
    label: 'Data Table',
    description: 'Searchable tabular data view'
  },
  {
    type: 'annotation_log',
    label: 'Annotation Log',
    description: 'Timeline + note entry'
  },
  {
    type: 'form_input',
    label: 'Form Input',
    description: 'Manual input capture module'
  }
]

const { list: listTemplates } = useTemplates()

const templates = ref<ModuleTemplate[]>([])
const templatesLoading = ref(false)
const templateError = ref('')
const templateSelection = reactive<Record<ModuleType, string>>(
  items.reduce(
    (selection, item) => ({
      ...selection,
      [item.type]: ''
    }),
    {} as Record<ModuleType, string>
  )
)

const templatesForType = (type: ModuleType) =>
  templates.value.filter((template) => template.type === type)

const loadTemplates = async () => {
  templatesLoading.value = true
  templateError.value = ''
  try {
    templates.value = await listTemplates()
  } catch (error) {
    templateError.value =
      error instanceof Error ? error.message : 'Failed to load templates'
  } finally {
    templatesLoading.value = false
  }
}

const addModule = (payload: { type: ModuleType; template?: ModuleTemplate }) => {
  if (props.disabled) {
    return
  }
  emit('add', payload)
}

const addBlankModule = (moduleType: ModuleType) => {
  addModule({ type: moduleType })
}

const addFromTemplate = (moduleType: ModuleType) => {
  const selectedTemplateId = templateSelection[moduleType]
  if (!selectedTemplateId) {
    return
  }
  const template = templates.value.find((item) => item.id === selectedTemplateId)
  if (!template) {
    return
  }
  addModule({ type: moduleType, template })
}

onMounted(loadTemplates)
</script>

<template>
  <aside class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-gray-900">Module Palette</h3>
      <p class="mt-1 text-xs text-gray-500">Add blank modules or create from templates.</p>
    </div>

    <p v-if="templatesLoading" class="mb-2 text-xs text-gray-500">Loading templates…</p>
    <p v-else-if="templateError" class="mb-2 text-xs text-red-600">{{ templateError }}</p>

    <div class="grid gap-3">
      <div
        v-for="item in items"
        :key="item.type"
        class="rounded border border-gray-200 px-3 py-2"
      >
        <p class="text-sm font-medium text-gray-800">{{ item.label }}</p>
        <p class="text-xs text-gray-500">{{ item.description }}</p>

        <div class="mt-2 flex gap-2">
          <button
            class="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="disabled"
            @click="addBlankModule(item.type)"
          >
            Add blank
          </button>
        </div>

        <div v-if="templatesForType(item.type).length" class="mt-2 space-y-2">
          <select
            v-model="templateSelection[item.type]"
            class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
            :disabled="disabled"
          >
            <option value="">Select template…</option>
            <option
              v-for="template in templatesForType(item.type)"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}
            </option>
          </select>
          <button
            class="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="disabled || !templateSelection[item.type]"
            @click="addFromTemplate(item.type)"
          >
            Add from template
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
