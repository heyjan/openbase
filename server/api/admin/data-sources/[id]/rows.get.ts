import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { getDuckDbRows } from '~~/server/utils/data-source-adapters/duckdb'
import { getMySqlRows } from '~~/server/utils/data-source-adapters/mysql'
import { getPostgresRows } from '~~/server/utils/data-source-adapters/postgresql'
import { getMongoRows } from '~~/server/utils/mongodb-connector'
import { getSqliteRows } from '~~/server/utils/sqlite-connector'

const toPositiveInt = (
  value: unknown,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {}
) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.trunc(parsed)
  if (rounded < min) {
    return min
  }

  return Math.min(rounded, max)
}

const toSortDirection = (value: unknown) => {
  if (typeof value !== 'string') {
    return 'asc' as const
  }
  return value.toLowerCase() === 'desc' ? 'desc' as const : 'asc' as const
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  const dataSource = await getDataSourceById(id)
  const { table, limit, page, sortBy, sortDir } = getQuery(event)
  if (typeof table !== 'string' || !table.trim()) {
    const label = dataSource.type === 'mongodb' ? 'Collection' : 'Table'
    throw createError({ statusCode: 400, statusMessage: `${label} is required` })
  }
  const tableName = table.trim()
  const safeLimit = toPositiveInt(limit, 50, { min: 1, max: 200 })
  const safePage = toPositiveInt(page, 1, { min: 1, max: 1000000 })
  const offset = (safePage - 1) * safeLimit
  const sortColumn =
    typeof sortBy === 'string' && sortBy.trim() ? sortBy.trim() : undefined
  const direction = toSortDirection(sortDir)
  const fetchLimit = safeLimit + 1

  const options = {
    offset,
    sortBy: sortColumn,
    sortDir: direction
  } as const

  let result: { columns: string[]; rows: Record<string, unknown>[] }

  if (dataSource.type === 'sqlite') {
    const filepath = String(dataSource.connection.filepath || '')
    result = getSqliteRows(filepath, tableName, fetchLimit, options)
  } else if (dataSource.type === 'duckdb') {
    result = await getDuckDbRows(dataSource.connection, tableName, fetchLimit, options)
  } else if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    result = await getPostgresRows(dataSource.connection, tableName, fetchLimit, options)
  } else if (dataSource.type === 'mysql') {
    result = await getMySqlRows(dataSource.connection, tableName, fetchLimit, options)
  } else if (dataSource.type === 'mongodb') {
    const uri = String(dataSource.connection.uri || '')
    const database = String(dataSource.connection.database || '')
    result = await getMongoRows(uri, database, tableName, fetchLimit, options)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
  }

  const hasMore = result.rows.length > safeLimit

  return {
    columns: result.columns,
    rows: hasMore ? result.rows.slice(0, safeLimit) : result.rows,
    page: safePage,
    limit: safeLimit,
    hasMore
  }
})
