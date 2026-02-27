<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'
import type { TableColumnSchema } from '~/types/editor'

definePageMeta({
  layout: 'editor'
})

const route = useRoute()
const tableId = computed(() => String(route.params.id || ''))
const { getSchema, getRows, insertRow, updateRows } = useEditorDataEntry()

const loading = ref(false)
const submittingInsert = ref(false)
const submittingUpdate = ref(false)
const loadError = ref('')
const actionError = ref('')
const successMessage = ref('')

const tableName = ref('')
const columns = ref<TableColumnSchema[]>([])
const rowColumns = ref<string[]>([])
const rows = ref<Record<string, unknown>[]>([])

const insertValues = ref<Record<string, unknown>>({})

const updateColumn = ref('')
const updateValue = ref('')
const whereColumn = ref('')
const whereValue = ref('')

const NUMBER_TYPES = new Set(['integer', 'smallint', 'bigint', 'numeric', 'decimal', 'real', 'double precision'])

const isBooleanType = (column: TableColumnSchema) => column.dataType === 'boolean'
const isDateType = (column: TableColumnSchema) => column.dataType === 'date'
const isNumberType = (column: TableColumnSchema) => NUMBER_TYPES.has(column.dataType)

const inputType = (column: TableColumnSchema) => {
  if (isDateType(column)) {
    return 'date'
  }
  if (isNumberType(column)) {
    return 'number'
  }
  return 'text'
}

const findColumn = (name: string) =>
  columns.value.find((column) => column.columnName === name)

const normalizeValue = (column: TableColumnSchema, value: unknown) => {
  if (value === '' || value === undefined) {
    return null
  }

  if (isBooleanType(column)) {
    if (value === true || value === false) {
      return value
    }
    if (typeof value === 'string') {
      const normalized = value.toLowerCase()
      if (normalized === 'true') {
        return true
      }
      if (normalized === 'false') {
        return false
      }
    }
    return value
  }

  if (isNumberType(column)) {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      return Number(value)
    }
  }

  return value
}

const resetInsertValues = () => {
  const next: Record<string, unknown> = {}
  for (const column of columns.value) {
    next[column.columnName] = ''
  }
  insertValues.value = next
}

const loadData = async () => {
  if (!tableId.value) {
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const [schemaPayload, rowsPayload] = await Promise.all([
      getSchema(tableId.value),
      getRows(tableId.value, 50)
    ])

    tableName.value = schemaPayload.table.tableName
    columns.value = schemaPayload.columns
    rowColumns.value = rowsPayload.columns
    rows.value = rowsPayload.rows

    resetInsertValues()

    if (schemaPayload.columns.length) {
      updateColumn.value = schemaPayload.columns[0].columnName
      whereColumn.value = schemaPayload.columns[0].columnName
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load table'
  } finally {
    loading.value = false
  }
}

const submitInsert = async () => {
  if (!tableId.value) {
    return
  }

  submittingInsert.value = true
  actionError.value = ''
  successMessage.value = ''

  try {
    const payload: Record<string, unknown> = {}
    for (const column of columns.value) {
      const raw = insertValues.value[column.columnName]
      if (raw === '' || raw === undefined) {
        continue
      }
      payload[column.columnName] = normalizeValue(column, raw)
    }

    await insertRow(tableId.value, payload)
    successMessage.value = 'Row inserted'
    await loadData()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Failed to insert row'
  } finally {
    submittingInsert.value = false
  }
}

const submitUpdate = async () => {
  if (!tableId.value) {
    return
  }

  const updateSchema = findColumn(updateColumn.value)
  const whereSchema = findColumn(whereColumn.value)
  if (!updateSchema || !whereSchema) {
    return
  }

  submittingUpdate.value = true
  actionError.value = ''
  successMessage.value = ''

  try {
    await updateRows(
      tableId.value,
      {
        [updateColumn.value]: normalizeValue(updateSchema, updateValue.value)
      },
      {
        [whereColumn.value]: normalizeValue(whereSchema, whereValue.value)
      }
    )

    successMessage.value = 'Rows updated'
    await loadData()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Failed to update rows'
  } finally {
    submittingUpdate.value = false
  }
}

watch(tableId, () => {
  loadData()
}, { immediate: true })
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      :title="tableName || 'Data Entry'"
      :breadcrumbs="[
        { label: 'Editor', to: '/editor' },
        { label: 'Data Entry', to: '/editor/data-entry' },
        { label: tableName || 'Table' }
      ]"
      back-to="/editor/data-entry"
      back-label="Back"
    />

    <p v-if="loading" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

    <template v-else>
      <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Insert</h2>

        <form class="mt-4 grid gap-4 md:grid-cols-2" @submit.prevent="submitInsert">
          <label
            v-for="column in columns"
            :key="column.columnName"
            class="block text-sm font-medium text-gray-700"
          >
            {{ column.columnName }}
            <select
              v-if="isBooleanType(column)"
              v-model="insertValues[column.columnName]"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">-</option>
              <option :value="'true'">true</option>
              <option :value="'false'">false</option>
            </select>
            <input
              v-else
              v-model="insertValues[column.columnName]"
              :type="inputType(column)"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div class="md:col-span-2">
            <button
              type="submit"
              class="rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="submittingInsert"
            >
              {{ submittingInsert ? 'Saving...' : 'Insert row' }}
            </button>
          </div>
        </form>
      </section>

      <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Update</h2>

        <form class="mt-4 grid gap-4 md:grid-cols-2" @submit.prevent="submitUpdate">
          <label class="block text-sm font-medium text-gray-700">
            Column
            <select
              v-model="updateColumn"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="column in columns" :key="column.columnName" :value="column.columnName">
                {{ column.columnName }}
              </option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Value
            <input
              v-model="updateValue"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Where column
            <select
              v-model="whereColumn"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="column in columns" :key="column.columnName" :value="column.columnName">
                {{ column.columnName }}
              </option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Where value
            <input
              v-model="whereValue"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div class="md:col-span-2">
            <button
              type="submit"
              class="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
              :disabled="submittingUpdate"
            >
              {{ submittingUpdate ? 'Saving...' : 'Update rows' }}
            </button>
          </div>
        </form>
      </section>

      <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Rows</h2>

        <div class="mt-4 overflow-auto">
          <table class="min-w-full border-collapse text-left text-sm">
            <thead class="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th v-for="column in rowColumns" :key="column" class="border-b border-gray-200 px-3 py-2">
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td class="border-b border-gray-200 px-3 py-4 text-sm text-gray-500" :colspan="Math.max(rowColumns.length, 1)">
                  No rows.
                </td>
              </tr>
              <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
                <td
                  v-for="column in rowColumns"
                  :key="`${rowIndex}-${column}`"
                  class="border-b border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  {{ row[column] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>
      <p v-if="successMessage" class="text-sm text-green-600">{{ successMessage }}</p>
    </template>
  </section>
</template>
