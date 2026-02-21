<script setup lang="ts">
import type { ModuleType } from '~/types/module'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'add', moduleType: ModuleType): void
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

const addModule = (moduleType: ModuleType) => {
  if (props.disabled) {
    return
  }
  emit('add', moduleType)
}
</script>

<template>
  <aside class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-gray-900">Module Palette</h3>
      <p class="mt-1 text-xs text-gray-500">Add modules to the dashboard canvas.</p>
    </div>

    <div class="grid gap-2">
      <button
        v-for="item in items"
        :key="item.type"
        class="rounded border border-gray-200 px-3 py-2 text-left hover:border-gray-300 disabled:opacity-50"
        :disabled="disabled"
        @click="addModule(item.type)"
      >
        <p class="text-sm font-medium text-gray-800">{{ item.label }}</p>
        <p class="text-xs text-gray-500">{{ item.description }}</p>
      </button>
    </div>
  </aside>
</template>
