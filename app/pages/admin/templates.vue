<script setup lang="ts">
import { Copy, Plus, Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { ModuleType } from '~/types/module'
import type { ModuleTemplate } from '~/types/template'

const { list, create, remove } = useTemplates()
const toast = useAppToast()

const templates = ref<ModuleTemplate[]>([])
const loading = ref(false)
const errorMessage = ref('')
const creating = ref(false)
const deletingId = ref<string | null>(null)
const copyingId = ref<string | null>(null)
const confirmDeleteOpen = ref(false)
const pendingDeleteTemplate = ref<ModuleTemplate | null>(null)

const form = reactive({
  name: '',
  type: 'time_series_chart' as ModuleType,
  configText: '{\n  "saved_query_id": ""\n}'
})

const moduleTypes: Array<{ value: ModuleType; label: string }> = [
  { value: 'time_series_chart', label: 'Time Series Chart' },
  { value: 'line_chart', label: 'Line Chart' },
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'scatter_chart', label: 'Scatter Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'outlier_table', label: 'Outlier Table' },
  { value: 'kpi_card', label: 'KPI Card' },
  { value: 'data_table', label: 'Data Table' },
  { value: 'annotation_log', label: 'Annotation Log' },
  { value: 'form_input', label: 'Form Input' }
]

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const loadTemplates = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    templates.value = await list()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load templates'
  } finally {
    loading.value = false
  }
}

const parseConfig = () => {
  const text = form.configText.trim() || '{}'
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Template config must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

const createTemplate = async () => {
  errorMessage.value = ''

  let config: Record<string, unknown>
  try {
    config = parseConfig()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Invalid JSON config'
    return
  }

  creating.value = true
  try {
    await create({
      name: form.name.trim(),
      type: form.type,
      config
    })
    form.name = ''
    await loadTemplates()
    toast.success('Template saved')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to create template'
    toast.error('Failed to save template', errorMessage.value)
  } finally {
    creating.value = false
  }
}

const openDeleteConfirm = (template: ModuleTemplate) => {
  pendingDeleteTemplate.value = template
  confirmDeleteOpen.value = true
}

const deleteTemplate = async () => {
  if (!pendingDeleteTemplate.value) {
    return
  }

  deletingId.value = pendingDeleteTemplate.value.id
  errorMessage.value = ''

  try {
    await remove(pendingDeleteTemplate.value.id)
    await loadTemplates()
    confirmDeleteOpen.value = false
    pendingDeleteTemplate.value = null
    toast.success('Template deleted')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete template'
    toast.error('Failed to delete template', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

const copyConfig = async (template: ModuleTemplate) => {
  if (!process.client || !navigator?.clipboard) {
    errorMessage.value = 'Clipboard access is not available in this browser.'
    return
  }

  copyingId.value = template.id
  errorMessage.value = ''
  try {
    await navigator.clipboard.writeText(JSON.stringify(template.config, null, 2))
    toast.success('Template config copied')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to copy template config'
    toast.error('Failed to copy template config', errorMessage.value)
  } finally {
    copyingId.value = null
  }
}

onMounted(loadTemplates)
</script>

<template>
  <section class="px-6 py-5">
    <PageHeader
      title="Module Templates"
      description="Save reusable module configurations and apply them when creating new modules."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Templates' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <form class="mt-6 grid gap-4 md:grid-cols-2" @submit.prevent="createTemplate">
      <label class="block text-sm font-medium text-gray-700">
        Template name
        <input
          v-model="form.name"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Standard Forecast Chart"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Module type
        <select
          v-model="form.type"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option v-for="option in moduleTypes" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="block text-sm font-medium text-gray-700 md:col-span-2">
        Module config (JSON)
        <textarea
          v-model="form.configText"
          rows="9"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        ></textarea>
      </label>

      <div class="md:col-span-2">
        <button
          class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="creating"
          type="submit"
        >
          <Plus class="h-4 w-4" />
          {{ creating ? 'Saving...' : 'Save template' }}
        </button>
      </div>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-red-600">{{ errorMessage }}</p>

    <div class="mt-10 space-y-4">
      <p v-if="loading" class="text-sm text-gray-500">Loading templates…</p>
      <p v-else-if="!templates.length" class="text-sm text-gray-500">
        No module templates yet.
      </p>

      <div
        v-else
        v-for="template in templates"
        :key="template.id"
        class="rounded border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ template.name }}</h2>
            <p class="text-xs text-gray-500">
              {{ template.type.replace(/_/g, ' ') }} • Created {{ formatDateTime(template.createdAt) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-50"
              :disabled="copyingId === template.id"
              @click="copyConfig(template)"
            >
              <Copy class="h-3.5 w-3.5" />
              {{ copyingId === template.id ? 'Copying...' : 'Copy config' }}
            </button>
            <button
              class="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:border-red-300 disabled:opacity-50"
              :disabled="deletingId === template.id"
              @click="openDeleteConfirm(template)"
            >
              <Trash2 class="h-3.5 w-3.5" />
              {{ deletingId === template.id ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>

        <pre class="mt-3 max-h-56 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">{{ JSON.stringify(template.config, null, 2) }}</pre>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete template?"
      :message="pendingDeleteTemplate ? `This removes template '${pendingDeleteTemplate.name}'.` : 'This removes the selected template.'"
      confirm-label="Delete template"
      confirm-tone="danger"
      :pending="pendingDeleteTemplate ? deletingId === pendingDeleteTemplate.id : false"
      @confirm="deleteTemplate"
    />
  </section>
</template>
