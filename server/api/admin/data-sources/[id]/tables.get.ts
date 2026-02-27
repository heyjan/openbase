import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { listDuckDbTables } from '~~/server/utils/data-source-adapters/duckdb'
import { listMySqlTables } from '~~/server/utils/data-source-adapters/mysql'
import { listPostgresTables } from '~~/server/utils/data-source-adapters/postgresql'
import { listMongoCollections } from '~~/server/utils/mongodb-connector'
import { listSqliteTables } from '~~/server/utils/sqlite-connector'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  const dataSource = await getDataSourceById(id)
  if (dataSource.type === 'sqlite') {
    const filepath = String(dataSource.connection.filepath || '')
    return listSqliteTables(filepath)
  }
  if (dataSource.type === 'duckdb') {
    return listDuckDbTables(dataSource.connection)
  }
  if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    return listPostgresTables(dataSource.connection)
  }
  if (dataSource.type === 'mysql') {
    return listMySqlTables(dataSource.connection)
  }
  if (dataSource.type === 'mongodb') {
    const uri = String(dataSource.connection.uri || '')
    const database = String(dataSource.connection.database || '')
    return listMongoCollections(uri, database)
  }
  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
})
