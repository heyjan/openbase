<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'
import QueryEditor from '~/components/admin/QueryEditor.vue'
import type { DataSource } from '~/types/data-source'
import type { SavedQueryPreviewResult } from '~/types/query'

type QueryEditorValue = {
  name: string
  dataSourceId: string
  description: string
  queryText: string
  parametersText: string
}

const route = useRoute()
const queryId = computed(() => String(route.params.id || ''))
const isNew = computed(() => queryId.value === 'new')

const { list: listDataSources } = useDataSources()
const { getById, create, update, preview } = useQueries()

const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const errorMessage = ref('')
const previewResult = ref<SavedQueryPreviewResult | null>(null)

const dataSources = ref<DataSource[]>([])
const form = ref<QueryEditorValue>({
  name: '',
  dataSourceId: '',
  description: '',
  queryText: '',
  parametersText: '{}'
})

const parseParametersText = () => {
  const text = form.value.parametersText.trim() || '{}'
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Parameters must be a JSON object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Invalid parameters JSON'
    )
  }
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
      return
    }

    const query = await getById(queryId.value)
    form.value = {
      name: query.name,
      dataSourceId: query.dataSourceId,
      description: query.description ?? '',
      queryText: query.queryText,
      parametersText: JSON.stringify(query.parameters ?? {}, null, 2)
    }
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

const saveQuery = async () => {
  errorMessage.value = ''
  previewResult.value = null

  let parameters: Record<string, unknown>
  try {
    parameters = parseParametersText()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Invalid parameters JSON'
    return
  }

  const payload = {
    name: form.value.name.trim(),
    dataSourceId: form.value.dataSourceId,
    description: form.value.description.trim() || undefined,
    queryText: form.value.queryText,
    parameters
  }

  if (!payload.name || !payload.dataSourceId || !payload.queryText.trim()) {
    errorMessage.value = 'Name, data source, and query text are required.'
    return
  }

  saving.value = true
  try {
    if (isNew.value) {
      const created = await create(payload)
      await navigateTo(`/admin/queries/${created.id}`)
      return
    }

    await update(queryId.value, payload)
    await load()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save query'
  } finally {
    saving.value = false
  }
}

const runPreview = async () => {
  if (isNew.value) {
    return
  }
  errorMessage.value = ''

  let parameters: Record<string, unknown>
  try {
    parameters = parseParametersText()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Invalid parameters JSON'
    return
  }

  previewing.value = true
  try {
    previewResult.value = await preview(queryId.value, { parameters, limit: 100 })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to run preview'
  } finally {
    previewing.value = false
  }
}

watch(queryId, () => {
  load()
})

onMounted(load)
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

    <p v-if="loading" class="mt-6 text-sm text-gray-500">Loading editor…</p>

    <div v-else class="mt-6">
      <QueryEditor
        :value="form"
        :data-sources="dataSources"
        :saving="saving"
        :previewing="previewing"
        :can-preview="!isNew"
        :preview-result="previewResult"
        :error-message="errorMessage"
        @update:value="updateForm"
        @save="saveQuery"
        @preview="runPreview"
      />
    </div>
  </section>
</template>
