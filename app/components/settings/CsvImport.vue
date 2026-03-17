<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import type { DataSource } from '~/types/data-source'
import type {
  CsvImportMode,
  CsvImportPreviewResponse
} from '~/types/csv-import'
import CsvDropzone from './CsvDropzone.vue'

type ImportState =
  | 'idle'
  | 'selecting'
  | 'uploading'
  | 'previewing'
  | 'importing'
  | 'done'
  | 'error'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel'])
const SUPPORTED_IMPORT_TYPES = new Set(['postgresql', 'postgres', 'mysql'])

const { list, listTables, previewCsvImport, importCsv } = useDataSources()
const toast = useAppToast()

const state = ref<ImportState>('idle')
const dataSources = ref<DataSource[]>([])
const tables = ref<string[]>([])

const loadingDataSources = ref(false)
const loadingTables = ref(false)
const previewPending = ref(false)
const importPending = ref(false)

const selectedDataSourceId = ref('')
const selectedTable = ref('')
const selectedFile = ref<File | null>(null)
const importMode = ref<CsvImportMode>('append')

const previewData = ref<CsvImportPreviewResponse | null>(null)
const dropzoneError = ref<string | null>(null)
const errorMessage = ref('')
const confirmReplaceOpen = ref(false)

const lastResult = ref<{ rowsImported: number; warnings: string[]; fileName: string } | null>(
  null
)

const selectedDataSource = computed(
  () => dataSources.value.find((source) => source.id === selectedDataSourceId.value) || null
)

const unsupportedMessage = computed(() => {
  if (!selectedDataSource.value) {
    return ''
  }

  if (SUPPORTED_IMPORT_TYPES.has(selectedDataSource.value.type)) {
    return ''
  }

  return `CSV import is not supported for ${selectedDataSource.value.type} data sources`
})

const dropzoneDisabled = computed(
  () =>
    !selectedDataSourceId.value ||
    !selectedTable.value ||
    !!unsupportedMessage.value ||
    loadingTables.value ||
    previewPending.value ||
    importPending.value
)

const canSubmitImport = computed(
  () =>
    !!previewData.value &&
    previewData.value.unmatchedCsvColumns.length === 0 &&
    !previewPending.value &&
    !importPending.value
)

const toErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    typeof (error as { data?: { statusMessage?: unknown } }).data?.statusMessage === 'string'
  ) {
    return (error as { data: { statusMessage: string } }).data.statusMessage
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

const updateSelectionState = () => {
  if (!selectedDataSourceId.value || !selectedTable.value) {
    state.value = 'idle'
    return
  }

  if (unsupportedMessage.value) {
    state.value = 'selecting'
    return
  }

  if (!selectedFile.value && !previewData.value) {
    state.value = 'selecting'
  }
}

const resetPreview = () => {
  previewRequestId += 1
  selectedFile.value = null
  previewData.value = null
  dropzoneError.value = null
  importMode.value = 'append'
}

const loadDataSources = async () => {
  loadingDataSources.value = true
  errorMessage.value = ''

  try {
    dataSources.value = (await list()).filter((source) => source.is_active)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Failed to load data sources')
    state.value = 'error'
  } finally {
    loadingDataSources.value = false
  }
}

const loadTables = async (dataSourceId: string) => {
  loadingTables.value = true
  errorMessage.value = ''

  try {
    tables.value = await listTables(dataSourceId)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Failed to load tables')
    state.value = 'error'
  } finally {
    loadingTables.value = false
  }
}

const validateFile = (file: File) => {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  const hasCsvExtension = fileName.endsWith('.csv')
  const hasAllowedMimeType = ALLOWED_MIME_TYPES.has(mimeType)

  if (!hasCsvExtension && !hasAllowedMimeType) {
    return 'Only .csv files are accepted'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File exceeds the 10 MB limit'
  }

  return null
}

let previewRequestId = 0

const fetchPreview = async () => {
  if (!selectedFile.value || !selectedDataSourceId.value || !selectedTable.value) {
    return
  }

  const requestId = ++previewRequestId
  previewPending.value = true
  errorMessage.value = ''
  state.value = 'uploading'

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('dataSourceId', selectedDataSourceId.value)
  formData.append('tableName', selectedTable.value)

  try {
    const response = await previewCsvImport(formData)

    if (requestId !== previewRequestId) {
      return
    }

    previewData.value = response
    state.value = 'previewing'

    if (response.warnings.length) {
      toast.info('Preview warnings', response.warnings.join(' '))
    }
  } catch (error) {
    if (requestId !== previewRequestId) {
      return
    }

    previewData.value = null
    errorMessage.value = toErrorMessage(error, 'Failed to preview CSV file')
    state.value = 'error'
  } finally {
    if (requestId === previewRequestId) {
      previewPending.value = false
    }
  }
}

const handleFileChange = (file: File | null) => {
  previewData.value = null
  errorMessage.value = ''
  dropzoneError.value = null
  lastResult.value = null

  if (!file) {
    selectedFile.value = null
    updateSelectionState()
    return
  }

  const validationError = validateFile(file)
  if (validationError) {
    selectedFile.value = null
    dropzoneError.value = validationError
    state.value = 'error'
    return
  }

  selectedFile.value = file
  void fetchPreview()
}

const handleDataSourceChange = async () => {
  selectedTable.value = ''
  tables.value = []
  errorMessage.value = ''
  lastResult.value = null
  resetPreview()

  if (!selectedDataSourceId.value) {
    updateSelectionState()
    return
  }

  if (unsupportedMessage.value) {
    updateSelectionState()
    return
  }

  await loadTables(selectedDataSourceId.value)
  updateSelectionState()
}

const handleTableChange = () => {
  errorMessage.value = ''
  lastResult.value = null
  resetPreview()
  updateSelectionState()
}

const cancelPreview = () => {
  resetPreview()
  errorMessage.value = ''
  updateSelectionState()
}

const runImport = async () => {
  if (!selectedFile.value || !selectedDataSourceId.value || !selectedTable.value) {
    return
  }

  importPending.value = true
  errorMessage.value = ''
  state.value = 'importing'

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('dataSourceId', selectedDataSourceId.value)
  formData.append('tableName', selectedTable.value)
  formData.append('mode', importMode.value)

  try {
    const response = await importCsv(formData)

    lastResult.value = {
      rowsImported: response.rowsImported,
      warnings: response.warnings,
      fileName: selectedFile.value.name
    }

    state.value = 'done'
    toast.success('Import completed', `${response.rowsImported.toLocaleString()} rows imported`)

    if (response.warnings.length) {
      toast.info('Import warnings', response.warnings.join(' '))
    }

    resetPreview()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Import failed')
    state.value = 'error'
  } finally {
    importPending.value = false
    confirmReplaceOpen.value = false
  }
}

const submitImport = () => {
  if (!canSubmitImport.value) {
    return
  }

  if (importMode.value === 'replace') {
    confirmReplaceOpen.value = true
    return
  }

  void runImport()
}

const startAnotherImport = () => {
  lastResult.value = null
  errorMessage.value = ''
  importMode.value = 'append'
  updateSelectionState()
}

onMounted(async () => {
  await loadDataSources()
  updateSelectionState()
})
</script>

<template>
  <section class="space-y-6">
    <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-6 flex items-center gap-2">
        <Upload class="h-5 w-5 text-gray-700" />
        <h2 class="text-lg font-semibold text-gray-900">Import Data from CSV</h2>
      </div>

      <div class="space-y-6">
        <section class="rounded border border-gray-200 p-4">
          <h3 class="text-sm font-semibold text-gray-900">Step 1: Select Target</h3>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="block text-sm font-medium text-gray-700">
              Data Source
              <select
                v-model="selectedDataSourceId"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                :disabled="loadingDataSources || importPending"
                @change="handleDataSourceChange"
              >
                <option value="">Select data source</option>
                <option
                  v-for="source in dataSources"
                  :key="source.id"
                  :value="source.id"
                >
                  {{ source.name }}
                </option>
              </select>
            </label>

            <label class="block text-sm font-medium text-gray-700">
              Table
              <select
                v-model="selectedTable"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                :disabled="!selectedDataSourceId || !!unsupportedMessage || loadingTables || importPending"
                @change="handleTableChange"
              >
                <option value="">Select table</option>
                <option v-for="table in tables" :key="table" :value="table">
                  {{ table }}
                </option>
              </select>
            </label>
          </div>

          <p v-if="loadingDataSources" class="mt-3 text-xs text-gray-500">Loading data sources...</p>
          <p v-if="loadingTables" class="mt-3 text-xs text-gray-500">Loading tables...</p>
          <p v-if="unsupportedMessage" class="mt-3 text-xs text-amber-700">{{ unsupportedMessage }}</p>
        </section>

        <section class="rounded border border-gray-200 p-4">
          <h3 class="text-sm font-semibold text-gray-900">Step 2: Upload CSV</h3>

          <div class="mt-4">
            <CsvDropzone
              :model-value="selectedFile"
              :disabled="dropzoneDisabled"
              :error="dropzoneError"
              :row-count="previewData?.totalRows ?? null"
              :column-count="previewData?.totalColumns ?? null"
              @update:model-value="handleFileChange"
            />
          </div>

          <div v-if="previewPending" class="mt-3 inline-flex items-center gap-2 text-xs text-gray-600">
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Generating preview
          </div>
        </section>

        <section class="rounded border border-gray-200 p-4">
          <h3 class="text-sm font-semibold text-gray-900">Step 3: Preview & Confirm</h3>

          <div v-if="state === 'done' && lastResult" class="mt-4 rounded border border-emerald-200 bg-emerald-50 p-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 class="h-4 w-4" />
              Import completed
            </div>
            <p class="mt-2 text-sm text-emerald-700">
              {{ lastResult.fileName }} - {{ lastResult.rowsImported.toLocaleString() }} rows imported
            </p>
            <p
              v-for="warning in lastResult.warnings"
              :key="warning"
              class="mt-1 text-xs text-amber-700"
            >
              {{ warning }}
            </p>
            <button
              type="button"
              class="mt-4 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
              @click="startAnotherImport"
            >
              Import Another File
            </button>
          </div>

          <template v-else>
            <div v-if="previewData" class="mt-4 space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3 rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-sm text-gray-800">
                  <p class="font-medium">{{ previewData.fileName }}</p>
                  <p class="text-xs text-gray-600">
                    {{ previewData.totalRows.toLocaleString() }} rows, {{ previewData.totalColumns.toLocaleString() }} columns
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:border-gray-400"
                  @click="cancelPreview"
                >
                  Remove
                </button>
              </div>

              <div class="rounded border border-gray-200 p-3">
                <div class="flex flex-wrap items-center gap-4 text-sm">
                  <label class="inline-flex items-center gap-2">
                    <input v-model="importMode" type="radio" value="append">
                    Append
                  </label>
                  <label class="inline-flex items-center gap-2">
                    <input v-model="importMode" type="radio" value="replace">
                    Replace
                  </label>
                </div>

                <p
                  v-if="importMode === 'replace'"
                  class="mt-2 inline-flex items-center gap-1 text-xs text-red-700"
                >
                  <AlertTriangle class="h-3.5 w-3.5" />
                  This will delete all existing rows in {{ selectedTable }}. This action cannot be undone.
                </p>
              </div>

              <div class="overflow-x-auto rounded border border-gray-200">
                <table class="min-w-full border-collapse text-left text-xs">
                  <thead class="bg-gray-50 text-gray-600">
                    <tr>
                      <th class="border-b border-gray-200 px-3 py-2 font-semibold">CSV Column</th>
                      <th class="border-b border-gray-200 px-3 py-2 font-semibold">Table Column</th>
                      <th class="border-b border-gray-200 px-3 py-2 font-semibold">Sample Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="mapping in previewData.columnMapping"
                      :key="mapping.csv"
                      class="bg-white"
                    >
                      <td class="border-b border-gray-200 px-3 py-2">{{ mapping.csv }}</td>
                      <td class="border-b border-gray-200 px-3 py-2" :class="mapping.matched ? 'text-gray-800' : 'text-red-600'">
                        {{ mapping.table || 'No match' }}
                      </td>
                      <td class="border-b border-gray-200 px-3 py-2">
                        {{ mapping.sampleValues.join(', ') || '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="overflow-x-auto rounded border border-gray-200">
                <table class="min-w-full border-collapse text-left text-xs">
                  <thead class="bg-gray-50 text-gray-600">
                    <tr>
                      <th
                        v-for="column in previewData.csvColumns"
                        :key="column"
                        class="border-b border-gray-200 px-3 py-2 font-semibold"
                      >
                        {{ column }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!previewData.previewRows.length">
                      <td
                        class="border-b border-gray-200 px-3 py-3 text-gray-500"
                        :colspan="Math.max(previewData.csvColumns.length, 1)"
                      >
                        No rows in CSV file.
                      </td>
                    </tr>
                    <tr
                      v-for="(row, rowIndex) in previewData.previewRows"
                      :key="rowIndex"
                      class="bg-white"
                    >
                      <td
                        v-for="column in previewData.csvColumns"
                        :key="`${rowIndex}-${column}`"
                        class="border-b border-gray-200 px-3 py-2"
                      >
                        {{ row[column] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p
                v-if="previewData.unmatchedCsvColumns.length"
                class="text-xs text-red-600"
              >
                CSV columns {{ previewData.unmatchedCsvColumns.join(', ') }} do not match any columns in table '{{ selectedTable }}'.
              </p>

              <p
                v-for="warning in previewData.warnings"
                :key="warning"
                class="text-xs text-amber-700"
              >
                {{ warning }}
              </p>

              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-gray-400"
                  :disabled="importPending"
                  @click="cancelPreview"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  :disabled="!canSubmitImport"
                  @click="submitImport"
                >
                  <Loader2 v-if="importPending" class="h-4 w-4 animate-spin" />
                  Import Data
                </button>
              </div>
            </div>

            <div v-else class="mt-4 text-xs text-gray-500"></div>
          </template>
        </section>
      </div>

      <p v-if="errorMessage" class="mt-4 text-sm text-red-600">{{ errorMessage }}</p>
    </section>

    <ConfirmDialog
      v-model="confirmReplaceOpen"
      title="Confirm replace import"
      :message="`This will delete all existing rows in ${selectedTable}. This action cannot be undone.`"
      confirm-label="Replace and import"
      cancel-label="Cancel"
      confirm-tone="danger"
      :pending="importPending"
      @confirm="runImport"
    />
  </section>
</template>
