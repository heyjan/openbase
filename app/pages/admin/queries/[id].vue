<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'
import QueryEditor from '~/components/admin/QueryEditor.vue'
import type { DataSource } from '~/types/data-source'
import type { ModuleType } from '~/types/module'
import type { QueryVisualization } from '~/types/query-visualization'
import type { SavedQueryPreviewResult } from '~/types/query'
import type { QueryPreviewVisualization } from '~/types/viz-options'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
}

const route = useRoute()
const queryId = computed(() => String(route.params.id || ''))
const isNew = computed(() => queryId.value === 'new')

const { list: listDataSources } = useDataSources()
const { list: listQueries, getById, create, update, preview } = useQueries()
const {
  list: listQueryVisualizations,
  create: createVisualization,
  update: updateVisualization
} = useQueryVisualizations()
const toast = useAppToast()

const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const errorMessage = ref('')
const previewResult = ref<SavedQueryPreviewResult | null>(null)
const lastSavedSignature = ref('')
const skipNextRouteLoad = ref(false)
const clientReady = ref(false)
const queryParameters = ref<Record<string, unknown>>({})
const previewParameters = ref<Record<string, unknown>>({})
const savedQueryOptions = ref<Array<{ id: string; name: string }>>([])
const savedVisualizations = ref<QueryVisualization[]>([])

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
  parameters: Record<string, unknown>
}

type PersistQueryOptions = {
  showSuccessToast?: boolean
  showErrorToast?: boolean
  showNoChangesToast?: boolean
}

type SaveQueryPayload = {
  visualization: QueryPreviewVisualization
  visualizationName: string
  visualizationModified: boolean
  config: Record<string, unknown>
}

const canPreview = computed(
  () => Boolean(form.value.name.trim() && form.value.dataSourceId && form.value.queryText.trim())
)

const buildPayload = (): QueryPayload => ({
  name: form.value.name.trim(),
  dataSourceId: form.value.dataSourceId,
  description: form.value.description.trim() || undefined,
  queryText: form.value.queryText,
  parameters: queryParameters.value
})

const getPayloadSignature = (payload: QueryPayload) =>
  JSON.stringify({
    name: payload.name,
    dataSourceId: payload.dataSourceId,
    description: payload.description ?? '',
    queryText: payload.queryText,
    parameters: payload.parameters
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
    const [sources, queries] = await Promise.all([
      listDataSources(),
      listQueries()
    ])
    dataSources.value = sources
    savedQueryOptions.value = queries.map((query) => ({
      id: query.id,
      name: query.name
    }))

    if (isNew.value) {
      form.value = {
        ...form.value,
        dataSourceId: form.value.dataSourceId || sources[0]?.id || ''
      }
      queryParameters.value = {}
      previewParameters.value = {}
      savedVisualizations.value = []
      lastSavedSignature.value = ''
      return
    }

    const [query, visualizations] = await Promise.all([
      getById(queryId.value),
      listQueryVisualizations({ savedQueryId: queryId.value })
    ])

    form.value = {
      name: query.name,
      dataSourceId: query.dataSourceId,
      description: query.description ?? '',
      queryText: query.queryText
    }
    queryParameters.value = query.parameters ?? {}
    previewParameters.value = {}
    savedVisualizations.value = visualizations
    lastSavedSignature.value = getPayloadSignature({
      name: query.name,
      dataSourceId: query.dataSourceId,
      description: query.description ?? undefined,
      queryText: query.queryText,
      parameters: query.parameters ?? {}
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

const updatePreviewParameters = (value: Record<string, unknown>) => {
  previewParameters.value = value
}

const updateQueryParameters = (value: Record<string, unknown>) => {
  queryParameters.value = value
}

const persistQuery = async (options: PersistQueryOptions = {}) => {
  const payload = buildPayload()
  if (!validatePayload(payload)) {
    if (options.showErrorToast !== false && errorMessage.value) {
      toast.error('Failed to save query', errorMessage.value)
    }
    return null
  }

  const payloadSignature = getPayloadSignature(payload)
  const needsCreate = isNew.value
  const needsUpdate = !needsCreate && payloadSignature !== lastSavedSignature.value

  if (!needsCreate && !needsUpdate) {
    if (options.showNoChangesToast) {
      toast.info('No changes to save')
    }
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

      if (options.showSuccessToast) {
        toast.success('Query created')
      }

      return created.id
    }

    await update(queryId.value, payload)
    lastSavedSignature.value = payloadSignature
    if (options.showSuccessToast) {
      toast.success('Query saved')
    }
    return queryId.value
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save query'
    if (options.showErrorToast !== false) {
      toast.error('Failed to save query', errorMessage.value)
    }
    return null
  } finally {
    saving.value = false
  }
}

const mapVisualizationToModule = (
  visualization: QueryPreviewVisualization,
  config: Record<string, unknown>
) => {
  if (visualization === 'table') {
    return {
      moduleType: 'data_table' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'kpi') {
    return {
      moduleType: 'kpi_card' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'bar') {
    return {
      moduleType: 'bar_chart' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'stacked_horizontal_bar') {
    return {
      moduleType: 'stacked_horizontal_bar_chart' as ModuleType,
      config: {
        ...config,
        stacked: true,
        horizontal: true
      } as Record<string, unknown>
    }
  }
  if (visualization === 'waterfall') {
    return {
      moduleType: 'waterfall_chart' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'radar') {
    return {
      moduleType: 'radar_chart' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'pie') {
    return {
      moduleType: 'pie_chart' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'scatter') {
    return {
      moduleType: 'scatter_chart' as ModuleType,
      config: { ...config } as Record<string, unknown>
    }
  }
  if (visualization === 'area') {
    return {
      moduleType: 'time_series_chart' as ModuleType,
      config: {
        area: true,
        ...config
      } as Record<string, unknown>
    }
  }
  return {
    moduleType: 'line_chart' as ModuleType,
    config: { ...config } as Record<string, unknown>
  }
}

const upsertVisualizationForQuery = async (input: {
  savedQueryId: string
  visualization: QueryPreviewVisualization
  name: string
  config: Record<string, unknown>
}) => {
  const mapped = mapVisualizationToModule(input.visualization, input.config ?? {})
  const existing = savedVisualizations.value.find(
    (visualization) => visualization.moduleType === mapped.moduleType
  )

  const saved = existing
    ? await updateVisualization(existing.id, {
        name: input.name,
        config: {
          ...mapped.config
        }
      })
    : await createVisualization({
        savedQueryId: input.savedQueryId,
        name: input.name,
        moduleType: mapped.moduleType,
        config: {
          ...mapped.config
        }
      })

  savedVisualizations.value = [
    saved,
    ...savedVisualizations.value.filter((visualization) => visualization.id !== saved.id)
  ]

  return {
    existed: Boolean(existing)
  }
}

const saveQuery = async (payload: SaveQueryPayload) => {
  errorMessage.value = ''
  previewResult.value = null

  const payloadSignature = getPayloadSignature(buildPayload())
  const queryWasNew = isNew.value
  const queryHasChanges = queryWasNew || payloadSignature !== lastSavedSignature.value

  const savedQueryId = await persistQuery({
    showSuccessToast: false,
    showErrorToast: true,
    showNoChangesToast: false
  })
  if (!savedQueryId) {
    return
  }

  let visualizationSaved = false
  if (payload.visualizationModified) {
    try {
      await upsertVisualizationForQuery({
        savedQueryId,
        visualization: payload.visualization,
        name: payload.visualizationName,
        config: payload.config
      })
      visualizationSaved = true
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Failed to save visualization options'
      toast.error('Failed to save query', errorMessage.value)
      return
    }
  }

  if (queryHasChanges) {
    toast.success(queryWasNew ? 'Query created' : 'Query saved')
    return
  }

  if (visualizationSaved) {
    toast.success('Query options saved')
    return
  }

  toast.info('No changes to save')
}

const runPreview = async () => {
  errorMessage.value = ''
  const savedQueryId = await persistQuery({
    showSuccessToast: false,
    showErrorToast: true
  })
  if (!savedQueryId) {
    return
  }

  previewing.value = true
  try {
    previewResult.value = await preview(savedQueryId, {
      limit: 100,
      parameters: previewParameters.value
    })
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
  config: Record<string, unknown>
}) => {
  errorMessage.value = ''
  const name = payload.name.trim()
  if (!name) {
    errorMessage.value = 'Visualization name is required.'
    return
  }

  const savedQueryId = await persistQuery({
    showSuccessToast: false,
    showErrorToast: false
  })
  if (!savedQueryId) {
    toast.error(
      'Failed to save visualization',
      errorMessage.value || 'Resolve query errors and try again.'
    )
    return
  }

  try {
    const result = await upsertVisualizationForQuery({
      savedQueryId,
      visualization: payload.visualization,
      name,
      config: payload.config
    })
    toast.success(result.existed ? 'Visualization updated' : 'Visualization saved')
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
  <section class="px-6 py-5">
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
        :query-parameters="queryParameters"
        :saved-queries="savedQueryOptions"
        :saved-visualizations="savedVisualizations"
        :current-query-id="isNew ? '' : queryId"
        :preview-parameters="previewParameters"
        :saving="saving"
        :previewing="previewing"
        :can-preview="canPreview"
        :preview-result="previewResult"
        :error-message="errorMessage"
        @update:value="updateForm"
        @update:query-parameters="updateQueryParameters"
        @update:preview-parameters="updatePreviewParameters"
        @save="saveQuery"
        @preview="runPreview"
        @save-visualization="saveVisualization"
      />
    </div>
  </section>
</template>
