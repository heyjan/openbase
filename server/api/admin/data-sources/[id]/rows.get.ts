import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getDuckDbRows } from '~~/server/utils/data-source-adapters/duckdb'
import { getMySqlRows } from '~~/server/utils/data-source-adapters/mysql'
import { getPostgresRows } from '~~/server/utils/data-source-adapters/postgresql'
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
  if (dataSource.type === 'duckdb') {
    return getDuckDbRows(dataSource.connection, table, safeLimit)
  }
  if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    return getPostgresRows(dataSource.connection, table, safeLimit)
  }
  if (dataSource.type === 'mysql') {
    return getMySqlRows(dataSource.connection, table, safeLimit)
  }
  if (dataSource.type === 'mongodb') {
    const uri = String(dataSource.connection.uri || '')
    const database = String(dataSource.connection.database || '')
    return getMongoRows(uri, database, table, safeLimit)
  }
  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
})
