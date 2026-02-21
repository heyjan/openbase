<script setup lang="ts">
import type { DataSource } from '~/types/data-source'
import type { SavedQueryPreviewResult } from '~/types/query'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
  parametersText: string
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
}>()

const updateValue = <K extends keyof QueryEditorValue>(
  key: K,
  value: QueryEditorValue[K]
) => {
  emit('update:value', {
    ...props.value,
    [key]: value
  })
}

const onTextInput = (event: Event, key: keyof QueryEditorValue) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
  updateValue(key, target?.value ?? '')
}

const onSelectInput = (event: Event, key: keyof QueryEditorValue) => {
  const target = event.target as HTMLSelectElement | null
  updateValue(key, target?.value ?? '')
}
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div class="grid gap-4 md:grid-cols-2">
      <label class="block text-sm font-medium text-gray-700">
        Name
        <input
          :value="value.name"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
        class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        @input="onTextInput($event, 'description')"
      />
    </label>

    <label class="mt-4 block text-sm font-medium text-gray-700">
      Query text
      <textarea
        :value="value.queryText"
        rows="10"
        class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        @input="onTextInput($event, 'queryText')"
      ></textarea>
    </label>

    <label class="mt-4 block text-sm font-medium text-gray-700">
      Default parameters (JSON object)
      <textarea
        :value="value.parametersText"
        rows="5"
        class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        @input="onTextInput($event, 'parametersText')"
      ></textarea>
    </label>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <button
        class="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="saving"
        @click="emit('save')"
      >
        {{ saving ? 'Saving...' : 'Save query' }}
      </button>
      <button
        class="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
        :disabled="previewing || !canPreview"
        @click="emit('preview')"
      >
        {{ previewing ? 'Running...' : 'Run preview' }}
      </button>
      <p v-if="!canPreview" class="text-xs text-gray-500">
        Save query first to enable preview.
      </p>
    </div>

    <p v-if="errorMessage" class="mt-3 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="previewResult" class="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <p>Rows: {{ previewResult.rowCount }}</p>
        <p>Columns: {{ previewResult.columns.length }}</p>
      </div>

      <div class="mt-2 overflow-auto">
        <table class="min-w-full border-collapse text-left text-xs">
          <thead class="bg-white text-gray-500">
            <tr>
              <th v-for="column in previewResult.columns" :key="column" class="px-2 py-1">
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in previewResult.rows"
              :key="rowIndex"
              class="border-t border-gray-100"
            >
              <td
                v-for="column in previewResult.columns"
                :key="`${rowIndex}-${column}`"
                class="max-w-72 truncate px-2 py-1 text-gray-700"
                :title="String(row[column] ?? '')"
              >
                {{ row[column] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
