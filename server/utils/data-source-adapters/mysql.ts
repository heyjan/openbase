import { createError } from 'h3'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/

type NamedQueryCompilation = {
  sql: string
  values: unknown[]
}

const toMySqlConnectionOptions = (connection: Record<string, unknown>) => {
  const uriValue =
    (typeof connection.uri === 'string' && connection.uri.trim()) ||
    (typeof connection.url === 'string' && connection.url.trim()) ||
    (typeof connection.connectionString === 'string' && connection.connectionString.trim())

  if (uriValue) {
    return {
      uri: uriValue,
      multipleStatements: false
    }
  }

  const host = typeof connection.host === 'string' ? connection.host.trim() : ''
  const user = typeof connection.user === 'string' ? connection.user.trim() : ''
  const database = typeof connection.database === 'string' ? connection.database.trim() : ''

  if (!host || !user || !database) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'MySQL connection requires either a URI or host/user/database'
    })
  }

  const port =
    typeof connection.port === 'number' && Number.isFinite(connection.port)
      ? Math.trunc(connection.port)
      : undefined

  return {
    host,
    port,
    user,
    password: typeof connection.password === 'string' ? connection.password : '',
    database,
    multipleStatements: false
  }
}

const compileNamedParameters = (
  queryText: string,
  parameters: Record<string, unknown>
): NamedQueryCompilation => {
  const values: unknown[] = []

  const sql = queryText.replace(
    /(^|[^:]):([A-Za-z_][A-Za-z0-9_]*)\b/g,
    (match, prefix: string, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Missing query parameter: ${name}`
        })
      }

      values.push(parameters[name])
      return `${prefix}?`
    }
  )

  return { sql, values }
}

const parseTableReference = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Table is required' })
  }

  const [schemaCandidate, tableCandidate] = trimmed.includes('.')
    ? trimmed.split('.', 2)
    : ['', trimmed]

  const schema = schemaCandidate.trim()
  const table = tableCandidate.trim()

  if ((schema && !IDENTIFIER_PATTERN.test(schema)) || !IDENTIFIER_PATTERN.test(table)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid table name' })
  }

  return { schema: schema || null, table }
}

const quoteIdentifier = (value: string) => `\`${value.replace(/`/g, '``')}\``

const getActiveDatabase = async (
  connection: Awaited<ReturnType<(typeof import('mysql2/promise'))['createConnection']>>
) => {
  const [rows] = await connection.query<Array<{ database_name: string | null }>>(
    'SELECT DATABASE() AS database_name'
  )
  return rows[0]?.database_name || null
}

const assertDatabaseForTable = async (
  connection: Awaited<ReturnType<(typeof import('mysql2/promise'))['createConnection']>>,
  schema: string | null
) => {
  if (schema) {
    return schema
  }

  const database = await getActiveDatabase(connection)
  if (!database) {
    throw createError({ statusCode: 400, statusMessage: 'MySQL database is required' })
  }
  return database
}

export const runMySqlQuery = async (
  connectionConfig: Record<string, unknown>,
  queryText: string,
  parameters: Record<string, unknown>,
  limit: number
) => {
  const mysql = await import('mysql2/promise')
  const connection = await mysql.createConnection(toMySqlConnectionOptions(connectionConfig))

  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY')
    const compiled = compileNamedParameters(queryText.trim().replace(/;\s*$/, ''), parameters)
    const wrappedSql = `SELECT * FROM (${compiled.sql}) AS _openbase_query LIMIT ?`
    const [rows, fields] = await connection.execute(wrappedSql, [...compiled.values, limit])

    const typedRows = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]
    const columns = Array.isArray(fields)
      ? fields.map((field) => String(field.name))
      : typedRows.length
        ? Object.keys(typedRows[0])
        : []

    return {
      rows: typedRows,
      columns,
      rowCount: typedRows.length
    }
  } finally {
    await connection.end()
  }
}

export const listMySqlTables = async (connectionConfig: Record<string, unknown>) => {
  const mysql = await import('mysql2/promise')
  const connection = await mysql.createConnection(toMySqlConnectionOptions(connectionConfig))

  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY')
    const database = await getActiveDatabase(connection)
    if (!database) {
      throw createError({ statusCode: 400, statusMessage: 'MySQL database is required' })
    }

    const [rows] = await connection.execute<Array<{ table_name: string }>>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [database]
    )

    return rows.map((row) => row.table_name)
  } finally {
    await connection.end()
  }
}

export const getMySqlRows = async (
  connectionConfig: Record<string, unknown>,
  table: string,
  limit = 50
) => {
  const mysql = await import('mysql2/promise')
  const connection = await mysql.createConnection(toMySqlConnectionOptions(connectionConfig))

  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY')

    const parsed = parseTableReference(table)
    const database = await assertDatabaseForTable(connection, parsed.schema)

    const [existsRows] = await connection.execute<Array<{ exists_flag: number }>>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = ?
           AND table_name = ?
       ) AS exists_flag`,
      [database, parsed.table]
    )

    if (!existsRows[0]?.exists_flag) {
      throw createError({ statusCode: 404, statusMessage: 'Table not found' })
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 1000)) : 50

    const tableReference = `${quoteIdentifier(database)}.${quoteIdentifier(parsed.table)}`
    const [rows, fields] = await connection.execute(
      `SELECT * FROM ${tableReference} LIMIT ?`,
      [safeLimit]
    )

    const typedRows = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]
    const columns = Array.isArray(fields)
      ? fields.map((field) => String(field.name))
      : typedRows.length
        ? Object.keys(typedRows[0])
        : []

    return {
      columns,
      rows: typedRows
    }
  } finally {
    await connection.end()
  }
}

export const testMySqlConnection = async (connectionConfig: Record<string, unknown>) => {
  const tables = await listMySqlTables(connectionConfig)
  return { ok: true, tables }
}
