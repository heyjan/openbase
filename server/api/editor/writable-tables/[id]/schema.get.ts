import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { canEditorWriteToTable } from '~~/server/utils/permission-store'
import { getPostgresTableSchema } from '~~/server/utils/table-schema'

export default defineEventHandler(async (event) => {
  const writableTableId = getRouterParam(event, 'id')
  if (!writableTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing writable table id' })
  }

  const editor = event.context.editor
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const permission = await canEditorWriteToTable(editor.id, writableTableId)
  if (!permission.allowed || !permission.config) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const dataSource = await getDataSourceById(permission.config.dataSourceId)
  if (!dataSource.is_active) {
    throw createError({ statusCode: 400, statusMessage: 'Data source is inactive' })
  }
  if (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres') {
    throw createError({ statusCode: 400, statusMessage: 'Writable tables require PostgreSQL' })
  }

  const schema = await getPostgresTableSchema(dataSource.connection, permission.config.tableName)
  const allowedColumnSet = permission.config.allowedColumns
    ? new Set(permission.config.allowedColumns.map((column) => column.toLowerCase()))
    : null

  return {
    table: permission.config,
    columns: schema.filter((column) => {
      if (!allowedColumnSet) {
        return true
      }
      return allowedColumnSet.has(column.columnName.toLowerCase())
    })
  }
})
