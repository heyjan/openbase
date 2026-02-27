import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { testDuckDbConnection } from '~~/server/utils/data-source-adapters/duckdb'
import { testMySqlConnection } from '~~/server/utils/data-source-adapters/mysql'
import { testPostgresConnection } from '~~/server/utils/data-source-adapters/postgresql'
import { testMongoConnection } from '~~/server/utils/mongodb-connector'
import { testSqliteConnection } from '~~/server/utils/sqlite-connector'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  const dataSource = await getDataSourceById(id)
  if (dataSource.type === 'sqlite') {
    const filepath = String(dataSource.connection.filepath || '')
    return testSqliteConnection(filepath)
  }
  if (dataSource.type === 'duckdb') {
    return testDuckDbConnection(dataSource.connection)
  }
  if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    return testPostgresConnection(dataSource.connection)
  }
  if (dataSource.type === 'mysql') {
    return testMySqlConnection(dataSource.connection)
  }
  if (dataSource.type === 'mongodb') {
    const uri = String(dataSource.connection.uri || '')
    const database = String(dataSource.connection.database || '')
    return testMongoConnection(uri, database)
  }
  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
})
