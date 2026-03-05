import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getDashboardBySlug, listModules } from '~~/server/utils/dashboard-store'
import { canEditorViewDashboard, canEditorWriteToTable } from '~~/server/utils/permission-store'
import {
  getPostgresTablePrimaryKey,
  getPostgresTableSchema
} from '~~/server/utils/table-schema'

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

const NON_EDITABLE: WritableMetaResponse = { editable: false }
const normalizeColumn = (value: string) => value.trim().toLowerCase()

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

const readWritableTableId = (config: Record<string, unknown>) => {
  const candidate = config.writableTableId ?? config.writable_table_id
  return typeof candidate === 'string' ? candidate.trim() : ''
}

export default defineEventHandler(async (event): Promise<WritableMetaResponse> => {
  const slug = getRouterParam(event, 'slug')
  const moduleId = getRouterParam(event, 'moduleId')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }

  const editor = event.context.editor
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dashboard = await getDashboardBySlug(slug)
  const canView = await canEditorViewDashboard(editor.id, dashboard.id)
  if (!canView) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const modules = await listModules(dashboard.id)
  const module = modules.find((item) => item.id === moduleId)
  if (!module) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }

  if (module.type !== 'data_table') {
    return NON_EDITABLE
  }

  const writableTableId = readWritableTableId(toRecord(module.config))
  if (!writableTableId) {
    return NON_EDITABLE
  }

  const permission = await canEditorWriteToTable(editor.id, writableTableId)
  if (!permission.allowed || !permission.config || !permission.config.allowUpdate) {
    return NON_EDITABLE
  }

  const dataSource = await getDataSourceById(permission.config.dataSourceId)
  if (
    !dataSource.is_active ||
    (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres')
  ) {
    return NON_EDITABLE
  }

  const schema = await getPostgresTableSchema(dataSource.connection, permission.config.tableName)
  const allColumns = schema.map((column) => column.columnName)
  const allColumnsByNormalizedName = new Map(
    allColumns.map((columnName) => [normalizeColumn(columnName), columnName])
  )

  const editableColumns = permission.config.allowedColumns
    ? permission.config.allowedColumns
        .map((column) => allColumnsByNormalizedName.get(normalizeColumn(column)))
        .filter((column): column is string => Boolean(column))
    : allColumns

  const uniqueEditableColumns = Array.from(new Set(editableColumns))
  if (!uniqueEditableColumns.length) {
    return NON_EDITABLE
  }

  const primaryKeyColumns = await getPostgresTablePrimaryKey(
    dataSource.connection,
    permission.config.tableName
  )
  if (!primaryKeyColumns.length) {
    return NON_EDITABLE
  }

  const identifierColumns = primaryKeyColumns

  return {
    editable: true,
    writableTableId,
    editableColumns: uniqueEditableColumns,
    identifierColumns
  }
})
