<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'
import QueryEditor from '~/components/admin/QueryEditor.vue'
import type { DataSource } from '~/types/data-source'
import type { ModuleType } from '~/types/module'
import type { SavedQueryPreviewResult } from '~/types/query'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
}

type QueryPreviewVisualization = 'table' | 'line' | 'area' | 'bar' | 'pie'

const route = useRoute()
const queryId = computed(() => String(route.params.id || ''))
const isNew = computed(() => queryId.value === 'new')

const { list: listDataSources } = useDataSources()
const { getById, create, update, preview } = useQueries()
const { create: createVisualization } = useQueryVisualizations()
const toast = useAppToast()

const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const errorMessage = ref('')
const previewResult = ref<SavedQueryPreviewResult | null>(null)
const lastSavedSignature = ref('')
const skipNextRouteLoad = ref(false)
const clientReady = ref(false)

const dataSources = ref<DataSource[]>([])
const form = ref<QueryEditorValue>({
  name: '',
  dataSourceId: '',
  description: '',
  queryText: ''
})

type QueryPayload = {
  name: string
  dataSourceId: string
  description?: string
  queryText: string
  parameters: Record<string, never>
}

const canPreview = computed(
  () => Boolean(form.value.name.trim() && form.value.dataSourceId && form.value.queryText.trim())
)

const buildPayload = (): QueryPayload => ({
  name: form.value.name.trim(),
  dataSourceId: form.value.dataSourceId,
  description: form.value.description.trim() || undefined,
  queryText: form.value.queryText,
  parameters: {}
})

const getPayloadSignature = (payload: QueryPayload) =>
  JSON.stringify({
    name: payload.name,
    dataSourceId: payload.dataSourceId,
    description: payload.description ?? '',
    queryText: payload.queryText
  })

const validatePayload = (payload: QueryPayload) => {
  if (!payload.name || !payload.dataSourceId || !payload.queryText.trim()) {
    errorMessage.value = 'Name, data source, and query text are required.'
    return false
  }
  return true
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  previewResult.value = null

  try {
    const sources = await listDataSources()
    dataSources.value = sources

    if (isNew.value) {
      form.value = {
        ...form.value,
        dataSourceId: form.value.dataSourceId || sources[0]?.id || ''
      }
      lastSavedSignature.value = ''
      return
    }

    const query = await getById(queryId.value)
    form.value = {
      name: query.name,
      dataSourceId: query.dataSourceId,
      description: query.description ?? '',
      queryText: query.queryText
    }
    lastSavedSignature.value = getPayloadSignature({
      name: query.name,
      dataSourceId: query.dataSourceId,
      description: query.description ?? undefined,
      queryText: query.queryText,
      parameters: {}
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load query editor'
  } finally {
    loading.value = false
  }
}

const updateForm = (value: QueryEditorValue) => {
  form.value = value
}

const persistQuery = async () => {
  const payload = buildPayload()
  if (!validatePayload(payload)) {
    return null
  }

  const payloadSignature = getPayloadSignature(payload)
  const needsCreate = isNew.value
  const needsUpdate = !needsCreate && payloadSignature !== lastSavedSignature.value

  if (!needsCreate && !needsUpdate) {
    return queryId.value
  }

  saving.value = true
  try {
    if (needsCreate) {
      const created = await create(payload)
      lastSavedSignature.value = payloadSignature

      if (queryId.value !== created.id) {
        skipNextRouteLoad.value = true
        await navigateTo(`/admin/queries/${created.id}`, { replace: true })
      }

      return created.id
    }

    await update(queryId.value, payload)
    lastSavedSignature.value = payloadSignature
    return queryId.value
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save query'
    return null
  } finally {
    saving.value = false
  }
}

const mapVisualizationToModule = (visualization: QueryPreviewVisualization) => {
  if (visualization === 'table') {
    return {
      moduleType: 'data_table' as ModuleType,
      config: {} as Record<string, unknown>
    }
  }
  if (visualization === 'bar') {
    return {
      moduleType: 'bar_chart' as ModuleType,
      config: {} as Record<string, unknown>
    }
  }
  if (visualization === 'pie') {
    return {
      moduleType: 'pie_chart' as ModuleType,
      config: {} as Record<string, unknown>
    }
  }
  if (visualization === 'area') {
    return {
      moduleType: 'time_series_chart' as ModuleType,
      config: {
        area: true
      } as Record<string, unknown>
    }
  }
  return {
    moduleType: 'line_chart' as ModuleType,
    config: {} as Record<string, unknown>
  }
}

const saveQuery = async () => {
  errorMessage.value = ''
  previewResult.value = null
  await persistQuery()
}

const runPreview = async () => {
  errorMessage.value = ''
  const savedQueryId = await persistQuery()
  if (!savedQueryId) {
    return
  }

  previewing.value = true
  try {
    previewResult.value = await preview(savedQueryId, { limit: 100 })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to run preview'
  } finally {
    previewing.value = false
  }
}

const saveVisualization = async (payload: {
  name: string
  visualization: QueryPreviewVisualization
}) => {
  errorMessage.value = ''
  const name = payload.name.trim()
  if (!name) {
    errorMessage.value = 'Visualization name is required.'
    return
  }

  const savedQueryId = await persistQuery()
  if (!savedQueryId) {
    return
  }

  const mapped = mapVisualizationToModule(payload.visualization)

  try {
    await createVisualization({
      savedQueryId,
      name,
      moduleType: mapped.moduleType,
      config: {
        ...mapped.config
      }
    })
    toast.success('Visualization saved')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save visualization'
    toast.error('Failed to save visualization', errorMessage.value)
  }
}

watch(queryId, () => {
  if (!clientReady.value) {
    return
  }
  if (skipNextRouteLoad.value) {
    skipNextRouteLoad.value = false
    return
  }
  load()
})

onMounted(async () => {
  clientReady.value = true
  await load()
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      :title="isNew ? 'New Query' : 'Edit Query'"
      description="Configure reusable queries and preview results."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Queries', to: '/admin/queries' },
        { label: isNew ? 'New' : 'Edit' }
      ]"
      back-to="/admin/queries"
      back-label="Back to queries"
    />

    <p v-if="loading || !clientReady" class="mt-6 text-sm text-gray-500">Loading editor…</p>

    <div v-else class="mt-6">
      <QueryEditor
        :value="form"
        :data-sources="dataSources"
        :saving="saving"
        :previewing="previewing"
        :can-preview="canPreview"
        :preview-result="previewResult"
        :error-message="errorMessage"
        @update:value="updateForm"
        @save="saveQuery"
        @preview="runPreview"
        @save-visualization="saveVisualization"
      />
    </div>
  </section>
</template>
