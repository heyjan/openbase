import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getWritableTableById, updateWritableTable } from '~~/server/utils/writable-table-store'
import { parseWritableTableUpdateInput } from '~~/server/utils/writable-table-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing writable table id' })
  }

  const payload = await readBody(event)
  const updates = parseWritableTableUpdateInput(payload)

  const existing = await getWritableTableById(id)
  const dataSourceId = updates.dataSourceId ?? existing.dataSourceId
  const dataSource = await getDataSourceById(dataSourceId)
  if (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Writable tables require a PostgreSQL data source'
    })
  }

  return updateWritableTable(id, updates)
})
