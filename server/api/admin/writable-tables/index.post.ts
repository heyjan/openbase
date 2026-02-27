import { createError, defineEventHandler, readBody } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { createWritableTable } from '~~/server/utils/writable-table-store'
import { parseWritableTableCreateInput } from '~~/server/utils/writable-table-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseWritableTableCreateInput(payload)

  const dataSource = await getDataSourceById(input.dataSourceId)
  if (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Writable tables require a PostgreSQL data source'
    })
  }

  return createWritableTable(input)
})
