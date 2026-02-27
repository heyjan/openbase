import { createError } from 'h3'
import { Pool } from 'pg'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/

const parseTableReference = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Table is required' })
  }

  const [schemaCandidate, tableCandidate] = trimmed.includes('.')
    ? trimmed.split('.', 2)
    : ['public', trimmed]

  const schema = schemaCandidate.trim()
  const table = tableCandidate.trim()

  if (!IDENTIFIER_PATTERN.test(schema) || !IDENTIFIER_PATTERN.test(table)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid table name' })
  }

  return { schema, table }
}

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`

export const toPostgresConnectionString = (connection: Record<string, unknown>) => {
  if (typeof connection.connectionString === 'string' && connection.connectionString.trim()) {
    return connection.connectionString.trim()
  }
  if (typeof connection.url === 'string' && connection.url.trim()) {
    return connection.url.trim()
  }
  if (typeof connection.uri === 'string' && connection.uri.trim()) {
    return connection.uri.trim()
  }
  return ''
}

const compileNamedParameters = (
  queryText: string,
  parameters: Record<string, unknown>
) => {
  const values: unknown[] = []
  const indexByName = new Map<string, number>()

  const text = queryText.replace(
    /(^|[^:]):([A-Za-z_][A-Za-z0-9_]*)\b/g,
    (match, prefix: string, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Missing query parameter: ${name}`
        })
      }

      let index = indexByName.get(name)
      if (!index) {
        values.push(parameters[name])
        index = values.length
        indexByName.set(name, index)
      }

      return `${prefix}$${index}`
    }
  )

  return { text, values }
}

export const runPostgresQuery = async (
  connection: Record<string, unknown>,
  queryText: string,
  parameters: Record<string, unknown>,
  limit: number
) => {
  const connectionString = toPostgresConnectionString(connection)
  if (!connectionString) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PostgreSQL connection string is required'
    })
  }

  const compiled = compileNamedParameters(queryText.trim().replace(/;\s*$/, ''), parameters)
  const limitPlaceholder = `$${compiled.values.length + 1}`
  const sql = `SELECT * FROM (${compiled.text}) AS _openbase_query LIMIT ${limitPlaceholder}`

  const pool = new Pool({ connectionString })
  try {
    const result = await pool.query<Record<string, unknown>>(sql, [
      ...compiled.values,
      limit
    ])
    return {
      rows: result.rows,
      columns: result.fields.map((field) => field.name),
      rowCount: result.rowCount ?? result.rows.length
    }
  } finally {
    await pool.end()
  }
}

const listRowsToTableName = (row: { table_schema: string; table_name: string }) =>
  row.table_schema === 'public' ? row.table_name : `${row.table_schema}.${row.table_name}`

export const listPostgresTables = async (connection: Record<string, unknown>) => {
  const connectionString = toPostgresConnectionString(connection)
  if (!connectionString) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PostgreSQL connection string is required'
    })
  }

  const pool = new Pool({ connectionString })
  try {
    const result = await pool.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`
    )
    return result.rows.map(listRowsToTableName)
  } finally {
    await pool.end()
  }
}

export const getPostgresRows = async (
  connection: Record<string, unknown>,
  table: string,
  limit = 50
) => {
  const connectionString = toPostgresConnectionString(connection)
  if (!connectionString) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PostgreSQL connection string is required'
    })
  }

  const { schema, table: tableName } = parseTableReference(table)
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 1000)) : 50

  const pool = new Pool({ connectionString })
  try {
    const existsResult = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name = $2
       ) AS exists`,
      [schema, tableName]
    )

    if (!existsResult.rows[0]?.exists) {
      throw createError({ statusCode: 404, statusMessage: 'Table not found' })
    }

    const sql = `SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(tableName)} LIMIT $1`
    const result = await pool.query<Record<string, unknown>>(sql, [safeLimit])
    return {
      columns: result.fields.map((field) => field.name),
      rows: result.rows
    }
  } finally {
    await pool.end()
  }
}

export const testPostgresConnection = async (connection: Record<string, unknown>) => {
  const tables = await listPostgresTables(connection)
  return { ok: true, tables }
}
