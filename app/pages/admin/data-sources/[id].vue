<script setup lang="ts">
import { ChevronDown, Table, Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'

const route = useRoute()
const dataSourceId = computed(() => String(route.params.id || ''))
const { getById, listTables, getRows, remove } = useDataSources()
const toast = useAppToast()

const { data: source, pending, error } = useAsyncData(
  () => getById(dataSourceId.value),
  { server: false }
)

const tableLabel = computed(() =>
  source.value?.type === 'mongodb' ? 'Collection' : 'Table'
)
const tableLabelPlural = computed(() =>
  source.value?.type === 'mongodb' ? 'collections' : 'tables'
)

const tables = ref<string[]>([])
const tableLoading = ref(false)
const tableError = ref('')

const selectedTable = ref('')
const rows = ref<Record<string, unknown>[]>([])
const columns = ref<string[]>([])
const rowsLoading = ref(false)
const rowsError = ref('')
const deleting = ref(false)
const deleteError = ref('')
const confirmDeleteOpen = ref(false)

const loadTables = async () => {
  tableLoading.value = true
  tableError.value = ''
  try {
    tables.value = await listTables(dataSourceId.value)
    selectedTable.value = tables.value[0] || ''
    if (selectedTable.value) {
      await loadRows()
    }
  } catch (err) {
    tableError.value =
      err instanceof Error
        ? err.message
        : `Failed to load ${tableLabelPlural.value}`
    toast.error('Failed to load tables', tableError.value)
  } finally {
    tableLoading.value = false
  }
}

const loadRows = async () => {
  if (!selectedTable.value) {
    rows.value = []
    columns.value = []
    return
  }
  rowsLoading.value = true
  rowsError.value = ''
  try {
    const result = await getRows(dataSourceId.value, selectedTable.value, 50)
    rows.value = result.rows
    columns.value = result.columns
  } catch (err) {
    rowsError.value = err instanceof Error ? err.message : 'Failed to load rows'
    toast.error('Failed to load rows', rowsError.value)
  } finally {
    rowsLoading.value = false
  }
}

const deleteSource = async () => {
  deleting.value = true
  deleteError.value = ''
  try {
    await remove(dataSourceId.value)
    confirmDeleteOpen.value = false
    toast.success('Data source deleted')
    await navigateTo('/admin/data-sources')
  } catch (err) {
    deleteError.value =
      err instanceof Error ? err.message : 'Failed to delete data source'
    toast.error('Failed to delete data source', deleteError.value)
  } finally {
    deleting.value = false
  }
}

watch(selectedTable, () => {
  loadRows()
})

onMounted(loadTables)
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Data Browser"
      description="Inspect data from this source."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Data Sources', to: '/admin/data-sources' },
        { label: 'Browse' }
      ]"
      back-to="/admin/data-sources"
      back-label="Back to data sources"
    >
      <template #actions>
        <button
          class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:border-red-300 disabled:opacity-50"
          :disabled="deleting"
          @click="confirmDeleteOpen = true"
        >
          <Trash2 class="h-4 w-4" />
          {{ deleting ? 'Deleting…' : 'Delete data source' }}
        </button>
      </template>
    </PageHeader>

    <p v-if="pending" class="mt-6 text-sm text-gray-500">Loading data source…</p>
    <p v-else-if="error" class="mt-6 text-sm text-red-600">
      {{ error?.message || 'Failed to load data source.' }}
    </p>

    <div v-else class="mt-6 space-y-6">
      <p v-if="deleteError" class="text-sm text-red-600">{{ deleteError }}</p>

      <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold">{{ source?.name }}</h2>
        <p class="text-xs text-gray-500">{{ source?.type }}</p>
        <p v-if="source?.type === 'sqlite'" class="text-xs text-gray-500">
          {{ source?.connection?.filepath }}
        </p>
        <p v-else-if="source?.type === 'mongodb'" class="text-xs text-gray-500">
          Database: {{ source?.connection?.database }}
        </p>
        <p v-if="source?.type === 'mongodb'" class="text-xs text-gray-500">
          {{ source?.connection?.uri }}
        </p>
      </div>

      <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Table class="h-4 w-4" />
            {{ tableLabel }}
          </div>
          <div class="relative">
            <select
              v-model="selectedTable"
              class="appearance-none rounded border border-gray-300 px-3 py-2 pr-8 text-sm"
            >
              <option v-for="table in tables" :key="table" :value="table">
                {{ table }}
              </option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>

        <p v-if="tableLoading" class="mt-4 text-sm text-gray-500">
          Loading {{ tableLabelPlural }}…
        </p>
        <p v-else-if="tableError" class="mt-4 text-sm text-red-600">
          {{ tableError }}
        </p>

        <div v-else class="mt-6 overflow-auto">
          <p v-if="rowsLoading" class="text-sm text-gray-500">Loading rows…</p>
          <p v-else-if="rowsError" class="text-sm text-red-600">
            {{ rowsError }}
          </p>
          <table
            v-else
            class="min-w-full border-collapse text-left text-sm"
          >
            <thead class="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th
                  v-for="column in columns"
                  :key="column"
                  class="border-b border-gray-200 px-3 py-2"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td
                  class="border-b border-gray-200 px-3 py-4 text-sm text-gray-500"
                  :colspan="Math.max(columns.length, 1)"
                >
                  No rows returned.
                </td>
              </tr>
              <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
                <td
                  v-for="column in columns"
                  :key="`${rowIndex}-${column}`"
                  class="border-b border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  {{ row[column] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete data source?"
      :message="source ? `This removes data source '${source.name}'. Queries using it will fail.` : 'This removes the selected data source.'"
      confirm-label="Delete data source"
      confirm-tone="danger"
      :pending="deleting"
      @confirm="deleteSource"
    />
  </section>
</template>
