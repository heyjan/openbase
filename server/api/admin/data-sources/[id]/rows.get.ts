import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getMongoRows } from '~~/server/utils/mongodb-connector'
import { getSqliteRows } from '~~/server/utils/sqlite-connector'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  const dataSource = await getDataSourceById(id)
  const { table, limit } = getQuery(event)
  if (!table || Array.isArray(table)) {
    const label = dataSource.type === 'mongodb' ? 'Collection' : 'Table'
    throw createError({ statusCode: 400, statusMessage: `${label} is required` })
  }
  const limitValue = typeof limit === 'string' ? Number(limit) : 50
  const safeLimit = Number.isNaN(limitValue) ? 50 : limitValue

  if (dataSource.type === 'sqlite') {
    const filepath = String(dataSource.connection.filepath || '')
    return getSqliteRows(filepath, table, safeLimit)
  }
  if (dataSource.type === 'mongodb') {
    const uri = String(dataSource.connection.uri || '')
    const database = String(dataSource.connection.database || '')
    return getMongoRows(uri, database, table, safeLimit)
  }
  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
})
