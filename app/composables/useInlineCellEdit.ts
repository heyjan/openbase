import type { Ref } from 'vue'

type TableRow = Record<string, unknown>

type EditingCell = {
  rowIndex: number
  columnKey: string
}

type WritableMetaResponse =
  | {
      editable: false
    }
  | {
      editable: true
      writableTableId: string
      editableColumns: string[]
      identifierColumns: string[]
    }

const NOT_EDITABLE_META: WritableMetaResponse = { editable: false }
const normalizeColumn = (value: string) => value.trim().toLowerCase()

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const record = error as {
      statusMessage?: string
      message?: string
      data?: {
        statusMessage?: string
        message?: string
      }
    }

    if (record.data?.statusMessage) {
      return record.data.statusMessage
    }
    if (record.statusMessage) {
      return record.statusMessage
    }
    if (record.data?.message) {
      return record.data.message
    }
    if (record.message) {
      return record.message
    }
  }

  return fallback
}

const toEditValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export const useInlineCellEdit = (input: {
  moduleId: Ref<string>
  enabled: Ref<boolean>
  refresh?: () => Promise<void>
}) => {
  const route = useRoute()
  const toast = useAppToast()
  const { updateRows } = useEditorDataEntry()

  const meta = ref<WritableMetaResponse>(NOT_EDITABLE_META)
  const metaLoading = ref(false)
  const metaLoadedKey = ref('')

  const editingCell = ref<EditingCell | null>(null)
  const editValue = ref('')
  const saving = ref(false)
  const saveError = ref('')

  const slug = computed(() =>
    typeof route.params.slug === 'string' ? route.params.slug : ''
  )

  const isEditorDashboardRoute = computed(
    () => route.path.startsWith('/editor/dashboards/') && !!slug.value
  )

  const metaFetchKey = computed(() => {
    if (!input.enabled.value || !isEditorDashboardRoute.value || !slug.value || !input.moduleId.value) {
      return ''
    }
    return `${slug.value}:${input.moduleId.value}`
  })

  const editableColumns = computed(() =>
    meta.value.editable ? meta.value.editableColumns : []
  )

  const editableColumnsSet = computed(() =>
    new Set(editableColumns.value.map(normalizeColumn))
  )

  const isColumnEditable = (columnKey: string) =>
    meta.value.editable && editableColumnsSet.value.has(normalizeColumn(columnKey))

  const clearEditingState = () => {
    editingCell.value = null
    editValue.value = ''
    saveError.value = ''
  }

  const cancelEdit = () => {
    if (saving.value) {
      return
    }
    clearEditingState()
  }

  const fetchMeta = async () => {
    if (!metaFetchKey.value) {
      meta.value = NOT_EDITABLE_META
      metaLoadedKey.value = ''
      return meta.value
    }

    if (metaLoadedKey.value === metaFetchKey.value) {
      return meta.value
    }

    metaLoading.value = true
    try {
      meta.value = await $fetch<WritableMetaResponse>(
        `/api/editor/dashboards/${encodeURIComponent(slug.value)}/modules/${encodeURIComponent(
          input.moduleId.value
        )}/writable-meta`,
        {
          credentials: 'include'
        }
      )
      metaLoadedKey.value = metaFetchKey.value
      return meta.value
    } catch (error) {
      meta.value = NOT_EDITABLE_META
      metaLoadedKey.value = metaFetchKey.value
      const message = extractErrorMessage(error, 'Unable to load table editing metadata.')
      toast.error('Inline editing unavailable', message)
      return meta.value
    } finally {
      metaLoading.value = false
    }
  }

  const startEdit = (rowIndex: number, columnKey: string, rows: TableRow[]) => {
    if (!isColumnEditable(columnKey) || saving.value) {
      return
    }

    const row = rows[rowIndex]
    if (!row) {
      return
    }

    editingCell.value = { rowIndex, columnKey }
    editValue.value = toEditValue(row[columnKey])
    saveError.value = ''
  }

  const setEditValue = (value: string) => {
    editValue.value = value
  }

  const saveCell = async (rows: TableRow[]) => {
    const currentEditingCell = editingCell.value
    if (!currentEditingCell || saving.value) {
      return
    }
    if (!meta.value.editable) {
      return
    }

    const row = rows[currentEditingCell.rowIndex]
    if (!row || !isColumnEditable(currentEditingCell.columnKey)) {
      clearEditingState()
      return
    }

    const where: Record<string, unknown> = {}
    for (const identifierColumn of meta.value.identifierColumns) {
      const identifierValue = row[identifierColumn]
      if (identifierValue === null || identifierValue === undefined) {
        saveError.value = `Missing identifier value for ${identifierColumn}.`
        toast.error('Cell update failed', saveError.value)
        return
      }
      where[identifierColumn] = identifierValue
    }

    if (!Object.keys(where).length) {
      saveError.value = 'No identifier columns available for update.'
      toast.error('Cell update failed', saveError.value)
      return
    }

    const nextValue = editValue.value === '' ? null : editValue.value
    const previousValue = row[currentEditingCell.columnKey]
    row[currentEditingCell.columnKey] = nextValue

    saving.value = true
    saveError.value = ''

    try {
      const response = await updateRows(
        meta.value.writableTableId,
        { [currentEditingCell.columnKey]: nextValue },
        where
      )

      const rowCount = response.rowCount ?? 0
      if (rowCount === 0) {
        row[currentEditingCell.columnKey] = previousValue
        saveError.value = 'No rows were updated. Refresh and try again.'
        toast.error('Cell update failed', saveError.value)
        return
      }

      if (rowCount > 1) {
        toast.info('Multiple rows updated', `${rowCount} rows matched this edit.`)
      }

      clearEditingState()

      if (input.refresh) {
        try {
          await input.refresh()
        } catch (error) {
          const message = extractErrorMessage(error, 'Failed to refresh table data.')
          toast.error('Cell saved, refresh failed', message)
        }
      }
    } catch (error) {
      row[currentEditingCell.columnKey] = previousValue
      saveError.value = extractErrorMessage(error, 'Failed to save cell.')
      toast.error('Cell update failed', saveError.value)
    } finally {
      saving.value = false
    }
  }

  watch(
    metaFetchKey,
    (nextKey, previousKey) => {
      if (nextKey === previousKey) {
        return
      }
      metaLoadedKey.value = ''
      meta.value = NOT_EDITABLE_META
      clearEditingState()

      if (nextKey) {
        fetchMeta()
      }
    },
    { immediate: true }
  )

  return {
    meta,
    metaLoading,
    editingCell,
    editValue,
    editableColumns,
    saving,
    saveError,
    fetchMeta,
    isColumnEditable,
    startEdit,
    setEditValue,
    cancelEdit,
    saveCell
  }
}
