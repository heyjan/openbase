import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getPostgresRows } from '~~/server/utils/data-source-adapters/postgresql'
import { canEditorWriteToTable } from '~~/server/utils/permission-store'

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

  const query = getQuery(event)
  const limit =
    typeof query.limit === 'string' && Number.isFinite(Number(query.limit))
      ? Number(query.limit)
      : 50

  return getPostgresRows(dataSource.connection, permission.config.tableName, limit)
})
