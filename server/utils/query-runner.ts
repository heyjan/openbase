import { createError } from 'h3'
import { query } from './db'
import { runPostgresQuery } from './data-source-adapters/postgresql'
import { runRestQuery } from './data-source-adapters/rest-api'
import { runMongoQuery } from './mongodb-connector'
import { runSqliteQuery } from './sqlite-connector'

type SavedQueryWithSourceRow = {
  saved_query_id: string
  query_text: string
  data_source_id: string
  data_source_type: string
  data_source_connection: Record<string, unknown>
  data_source_active: boolean
}

export type QueryExecutionResult = {
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
}

const disallowedWriteSql = /\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke)\b/i
const allowedReadSql = /^\s*(select|with)\b/i
const positionalParametersPattern = /\$\d+\b/

const parseLimit = (value: number | undefined, fallback: number, max: number) => {
  const raw = value ?? fallback
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query limit' })
  }
  const integer = Math.trunc(raw)
  if (integer < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Limit must be greater than zero' })
  }
  return Math.min(integer, max)
}

const normalizeParameters = (value: unknown) => {
  if (value === undefined || value === null) {
    return {} as Record<string, unknown>
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' })
  }
  return value as Record<string, unknown>
}

const assertReadOnlySql = (queryText: string) => {
  const normalized = queryText.trim().replace(/;\s*$/, '')
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Query text is required' })
  }
  if (!allowedReadSql.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only SELECT/CTE queries are allowed'
    })
  }
  if (disallowedWriteSql.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Write operations are not allowed in saved queries'
    })
  }
  if (positionalParametersPattern.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use named parameters like :asin, not positional placeholders'
    })
  }
  return normalized
}

export const runQuery = async (input: {
  dataSourceType: string
  connection: Record<string, unknown>
  queryText: string
  parameters?: Record<string, unknown>
  limit?: number
}): Promise<QueryExecutionResult> => {
  const parameters = normalizeParameters(input.parameters)
  const limit = parseLimit(input.limit, 100, 1000)

  if (input.dataSourceType === 'sqlite') {
    const filepath = String(input.connection.filepath || '')
    if (!filepath.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'SQLite file path is required' })
    }
    return runSqliteQuery(filepath, assertReadOnlySql(input.queryText), parameters, limit)
  }

  if (input.dataSourceType === 'postgresql' || input.dataSourceType === 'postgres') {
    return runPostgresQuery(
      input.connection,
      assertReadOnlySql(input.queryText),
      parameters,
      limit
    )
  }

  if (input.dataSourceType === 'mongodb') {
    const uri = String(input.connection.uri || '')
    const database = String(input.connection.database || '')
    const collection = input.queryText.trim()
    if (!collection) {
      throw createError({
        statusCode: 400,
        statusMessage: 'MongoDB saved query text must be a collection name'
      })
    }
    return runMongoQuery(uri, database, collection, parameters, limit)
  }

  if (input.dataSourceType === 'rest_api') {
    return runRestQuery()
  }

  throw createError({
    statusCode: 400,
    statusMessage: `Unsupported data source type: ${input.dataSourceType}`
  })
}

export const runSavedQueryById = async (input: {
  savedQueryId: string
  parameters?: Record<string, unknown>
  limit?: number
}): Promise<QueryExecutionResult> => {
  const result = await query<SavedQueryWithSourceRow>(
    `SELECT
       sq.id AS saved_query_id,
       sq.query_text,
       ds.id AS data_source_id,
       ds.type AS data_source_type,
       ds.connection AS data_source_connection,
       ds.is_active AS data_source_active
     FROM saved_queries sq
     JOIN data_sources ds ON ds.id = sq.data_source_id
     WHERE sq.id = $1`,
    [input.savedQueryId]
  )

  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Saved query not found' })
  }
  if (!row.data_source_active) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Saved query uses an inactive data source'
    })
  }

  return runQuery({
    dataSourceType: row.data_source_type,
    connection: row.data_source_connection || {},
    queryText: row.query_text,
    parameters: input.parameters ?? {},
    limit: input.limit
  })
}
