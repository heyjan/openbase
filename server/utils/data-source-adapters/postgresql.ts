import { createError } from 'h3'
import { Pool } from 'pg'

const toConnectionString = (connection: Record<string, unknown>) => {
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
  const connectionString = toConnectionString(connection)
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
