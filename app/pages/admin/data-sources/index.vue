<script setup lang="ts">
import { Database, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { DataSource } from '~/types/data-source'

const { list, create, test, remove } = useDataSources()
const toast = useAppToast()

const sources = ref<DataSource[]>([])
const loading = ref(false)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)
const confirmDeleteOpen = ref(false)
const pendingDeleteSource = ref<DataSource | null>(null)

const newSource = reactive({
  name: '',
  type: 'sqlite',
  filepath: '',
  uri: '',
  database: ''
})
const creating = ref(false)
const createError = ref('')

const loadSources = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    sources.value = await list()
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Failed to load data sources'
    toast.error('Failed to load data sources', errorMessage.value)
  } finally {
    loading.value = false
  }
}

const addSource = async () => {
  createError.value = ''
  creating.value = true
  try {
    const connection =
      newSource.type === 'mongodb'
        ? { uri: newSource.uri, database: newSource.database }
        : { filepath: newSource.filepath }
    await create({
      name: newSource.name,
      type: newSource.type,
      connection
    })
    newSource.name = ''
    newSource.filepath = ''
    newSource.uri = ''
    newSource.database = ''
    await loadSources()
    toast.success('Data source added')
  } catch (err) {
    createError.value =
      err instanceof Error ? err.message : 'Failed to create data source'
    toast.error('Failed to create data source', createError.value)
  } finally {
    creating.value = false
  }
}

const testingId = ref<string | null>(null)
const testMessage = ref('')

const testSource = async (source: DataSource) => {
  testMessage.value = ''
  testingId.value = source.id
  try {
    const result = await test(source.id)
    const label = source.type === 'mongodb' ? 'Collections' : 'Tables'
    testMessage.value = `Connected. ${label} found: ${result.tables?.length ?? 0}`
    toast.success('Connection test successful', testMessage.value)
  } catch (err) {
    testMessage.value = err instanceof Error ? err.message : 'Test failed'
    toast.error('Connection test failed', testMessage.value)
  } finally {
    testingId.value = null
  }
}

const openDeleteConfirm = (source: DataSource) => {
  pendingDeleteSource.value = source
  confirmDeleteOpen.value = true
}

const deleteSource = async () => {
  if (!pendingDeleteSource.value) {
    return
  }

  deletingId.value = pendingDeleteSource.value.id
  errorMessage.value = ''
  try {
    await remove(pendingDeleteSource.value.id)
    await loadSources()
    confirmDeleteOpen.value = false
    pendingDeleteSource.value = null
    toast.success('Data source deleted')
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Failed to delete data source'
    toast.error('Failed to delete data source', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

onMounted(loadSources)
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Data Sources"
      description="Connect databases and browse their data."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Data Sources' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <form class="mt-6 grid gap-4 md:grid-cols-2" @submit.prevent="addSource">
      <label class="block text-sm font-medium text-gray-700">
        Name
        <input
          v-model="newSource.name"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Local SQLite"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Provider
        <select
          v-model="newSource.type"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="sqlite">SQLite (current)</option>
          <option disabled value="postgres">PostgreSQL (coming soon)</option>
          <option disabled value="mysql">MySQL/MariaDB (coming soon)</option>
          <option value="mongodb">MongoDB</option>
        </select>
      </label>

      <label
        v-if="newSource.type === 'sqlite'"
        class="block text-sm font-medium text-gray-700 md:col-span-2"
      >
        SQLite file path
        <input
          v-model="newSource.filepath"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="/workspace/db/local.sqlite"
          required
        />
      </label>
      <label
        v-if="newSource.type === 'mongodb'"
        class="block text-sm font-medium text-gray-700 md:col-span-2"
      >
        MongoDB connection URI
        <input
          v-model="newSource.uri"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="mongodb://localhost:27017"
          required
        />
      </label>
      <label
        v-if="newSource.type === 'mongodb'"
        class="block text-sm font-medium text-gray-700 md:col-span-2"
      >
        Database name
        <input
          v-model="newSource.database"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="openbase"
          required
        />
      </label>

      <div class="md:col-span-2">
        <button
          class="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          :disabled="creating"
          type="submit"
        >
          <Plus class="h-4 w-4" />
          Add data source
        </button>
      </div>
    </form>

    <p v-if="createError" class="mt-4 text-sm text-red-600">{{ createError }}</p>

    <div class="mt-10">
      <p v-if="loading" class="text-sm text-gray-500">Loading data sources…</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">
        {{ errorMessage }}
      </p>

      <div v-else class="space-y-4">
        <div
          v-for="source in sources"
          :key="source.id"
          class="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="rounded bg-gray-100 p-2 text-gray-600">
                <Database class="h-4 w-4" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">{{ source.name }}</h2>
                <p class="text-xs text-gray-500">{{ source.type }}</p>
                <p v-if="source.type === 'sqlite'" class="text-xs text-gray-500">
                  {{ source.connection?.filepath }}
                </p>
                <p v-else-if="source.type === 'mongodb'" class="text-xs text-gray-500">
                  Database: {{ source.connection?.database }}
                </p>
                <p v-else class="text-xs text-gray-500">
                  {{ source.connection?.filepath }}
                </p>
                <p v-if="source.type === 'mongodb'" class="text-xs text-gray-500">
                  {{ source.connection?.uri }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <NuxtLink
                class="rounded border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300"
                :to="`/admin/data-sources/${source.id}`"
              >
                Browse data
              </NuxtLink>
              <button
                class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300"
                :disabled="testingId === source.id"
                @click="testSource(source)"
              >
                <RefreshCw class="h-4 w-4" />
                Test connection
              </button>
              <button
                class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-red-700 hover:border-red-300 disabled:opacity-50"
                :disabled="deletingId === source.id"
                @click="openDeleteConfirm(source)"
              >
                <Trash2 class="h-4 w-4" />
                {{ deletingId === source.id ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="testMessage" class="mt-4 text-sm text-gray-600">
        {{ testMessage }}
      </p>
    </div>

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete data source?"
      :message="pendingDeleteSource ? `This removes data source '${pendingDeleteSource.name}'. Queries using it will fail.` : 'This removes the selected data source.'"
      confirm-label="Delete data source"
      confirm-tone="danger"
      :pending="pendingDeleteSource ? deletingId === pendingDeleteSource.id : false"
      @confirm="deleteSource"
    />
  </section>
</template>
