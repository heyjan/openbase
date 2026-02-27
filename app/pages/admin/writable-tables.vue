<script setup lang="ts">
import { Plus, Save, Trash2 } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { DataSource } from '~/types/data-source'
import type { WritableTable } from '~/types/editor'

type WritableTableForm = WritableTable & {
  allowedColumnsText: string
  descriptionInput: string
}

const { list, create, update, remove } = useWritableTables()
const { list: listDataSources } = useDataSources()

const writableTables = ref<WritableTableForm[]>([])
const dataSources = ref<DataSource[]>([])

const loading = ref(false)
const errorMessage = ref('')

const creating = ref(false)
const createError = ref('')
const newTable = reactive({
  dataSourceId: '',
  tableName: '',
  allowedColumnsText: '',
  allowInsert: true,
  allowUpdate: true,
  description: ''
})

const updatingId = ref<string | null>(null)
const updateError = ref('')
const deletingId = ref<string | null>(null)

const parseAllowedColumns = (value: string) => {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length ? Array.from(new Set(items)) : null
}

const mapWritableTable = (table: WritableTable): WritableTableForm => ({
  ...table,
  allowedColumnsText: table.allowedColumns?.join(', ') ?? '',
  descriptionInput: table.description ?? ''
})

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [tables, sources] = await Promise.all([list(), listDataSources()])
    writableTables.value = tables.map(mapWritableTable)
    dataSources.value = sources.filter(
      (source) => source.type === 'postgresql' || source.type === 'postgres'
    )

    if (!newTable.dataSourceId && dataSources.value.length) {
      newTable.dataSourceId = dataSources.value[0].id
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load writable tables'
  } finally {
    loading.value = false
  }
}

const addWritableTable = async () => {
  createError.value = ''
  creating.value = true

  try {
    await create({
      dataSourceId: newTable.dataSourceId,
      tableName: newTable.tableName,
      allowedColumns: parseAllowedColumns(newTable.allowedColumnsText),
      allowInsert: newTable.allowInsert,
      allowUpdate: newTable.allowUpdate,
      description: newTable.description.trim() || null
    })

    newTable.tableName = ''
    newTable.allowedColumnsText = ''
    newTable.allowInsert = true
    newTable.allowUpdate = true
    newTable.description = ''

    await loadData()
  } catch (error) {
    createError.value =
      error instanceof Error ? error.message : 'Failed to create writable table'
  } finally {
    creating.value = false
  }
}

const saveWritableTable = async (table: WritableTableForm) => {
  updateError.value = ''
  updatingId.value = table.id

  try {
    await update(table.id, {
      dataSourceId: table.dataSourceId,
      tableName: table.tableName,
      allowedColumns: parseAllowedColumns(table.allowedColumnsText),
      allowInsert: table.allowInsert,
      allowUpdate: table.allowUpdate,
      description: table.descriptionInput.trim() || null
    })
    await loadData()
  } catch (error) {
    updateError.value =
      error instanceof Error ? error.message : 'Failed to update writable table'
  } finally {
    updatingId.value = null
  }
}

const deleteWritableTable = async (id: string) => {
  deletingId.value = id
  errorMessage.value = ''

  try {
    await remove(id)
    await loadData()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete writable table'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Writable Tables"
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Writable Tables' }
      ]"
      back-to="/admin"
      back-label="Back"
    />

    <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="addWritableTable">
        <label class="block text-sm font-medium text-gray-700">
          Data source
          <select
            v-model="newTable.dataSourceId"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option v-for="source in dataSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Table name
          <input
            v-model="newTable.tableName"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label class="block text-sm font-medium text-gray-700 md:col-span-2">
          Allowed columns
          <input
            v-model="newTable.allowedColumnsText"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Allow insert
          <select
            v-model="newTable.allowInsert"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option :value="true">Yes</option>
            <option :value="false">No</option>
          </select>
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Allow update
          <select
            v-model="newTable.allowUpdate"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option :value="true">Yes</option>
            <option :value="false">No</option>
          </select>
        </label>

        <label class="block text-sm font-medium text-gray-700 md:col-span-2">
          Description
          <input
            v-model="newTable.description"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div class="md:col-span-2">
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="creating"
          >
            <Plus class="h-4 w-4" />
            Add table
          </button>
        </div>
      </form>

      <p v-if="createError" class="mt-4 text-sm text-red-600">{{ createError }}</p>
    </section>

    <section class="space-y-4">
      <p v-if="loading" class="text-sm text-gray-500">Loading...</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <div
        v-else
        v-for="table in writableTables"
        :key="table.id"
        class="rounded border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium text-gray-700">
            Data source
            <select
              v-model="table.dataSourceId"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="source in dataSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Table name
            <input
              v-model="table.tableName"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="block text-sm font-medium text-gray-700 md:col-span-2">
            Allowed columns
            <input
              v-model="table.allowedColumnsText"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Allow insert
            <select
              v-model="table.allowInsert"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option :value="true">Yes</option>
              <option :value="false">No</option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Allow update
            <select
              v-model="table.allowUpdate"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option :value="true">Yes</option>
              <option :value="false">No</option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700 md:col-span-2">
            Description
            <input
              v-model="table.descriptionInput"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
            :disabled="updatingId === table.id"
            @click="saveWritableTable(table)"
          >
            <Save class="h-4 w-4" />
            Save
          </button>

          <button
            class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
            :disabled="deletingId === table.id"
            @click="deleteWritableTable(table.id)"
          >
            <Trash2 class="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <p v-if="updateError" class="text-sm text-red-600">{{ updateError }}</p>
    </section>
  </section>
</template>
