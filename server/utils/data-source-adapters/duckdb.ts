import fs from 'node:fs'
import { createError } from 'h3'
import { resolveDataFilePath } from '~~/server/utils/data-path'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/

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

const parseTableReference = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Table is required' })
  }

  const [schemaCandidate, tableCandidate] = trimmed.includes('.')
    ? trimmed.split('.', 2)
    : ['main', trimmed]

  const schema = schemaCandidate.trim()
  const table = tableCandidate.trim()

  if (!IDENTIFIER_PATTERN.test(schema) || !IDENTIFIER_PATTERN.test(table)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid table name' })
  }

  return { schema, table }
}

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`

const createDatabase = async (filepath: string) => {
  const duckdb = await import('duckdb')
  const resolvedPath = resolveDataFilePath(filepath, { allowMemory: true })

  if (resolvedPath !== ':memory:' && !fs.existsSync(resolvedPath)) {
    throw createError({ statusCode: 404, statusMessage: 'DuckDB file not found' })
  }

  const openFlags = resolvedPath === ':memory:' ? undefined : (duckdb as any).OPEN_READONLY

  return await new Promise<any>((resolve, reject) => {
    const handleOpen = (error: unknown, db: unknown) => {
      if (error) {
        reject(error)
        return
      }
      resolve(db)
    }

    let db: any
    if (openFlags === undefined) {
      db = new (duckdb as any).Database(resolvedPath, (error: unknown) =>
        handleOpen(error, db)
      )
      return
    }

    db = new (duckdb as any).Database(resolvedPath, openFlags, (error: unknown) =>
      handleOpen(error, db)
    )
  })
}

const withConnection = async <T>(filepath: string, runner: (connection: any) => Promise<T>) => {
  const db = await createDatabase(filepath)
  const connection = db.connect()

  const all = (sql: string, params: unknown[] = []) =>
    new Promise<any[]>((resolve, reject) => {
      connection.all(sql, params, (error: unknown, rows: unknown[]) => {
        if (error) {
          reject(error)
          return
        }
        resolve(rows as any[])
      })
    })

  const run = (sql: string) =>
    new Promise<void>((resolve, reject) => {
      connection.run(sql, (error: unknown) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

  try {
    await run('SET enable_http_filesystem = false')
    return await runner({ all, run })
  } finally {
    connection.close()
    db.close()
  }
}

export const runDuckDbQuery = async (
  connection: Record<string, unknown>,
  queryText: string,
  parameters: Record<string, unknown>,
  limit: number
) => {
  const filepath = typeof connection.filepath === 'string' ? connection.filepath.trim() : ''
  if (!filepath) {
    throw createError({ statusCode: 400, statusMessage: 'DuckDB file path is required' })
  }

  const compiled = compileNamedParameters(queryText.trim().replace(/;\s*$/, ''), parameters)
  const limitPlaceholder = `$${compiled.values.length + 1}`
  const sql = `SELECT * FROM (${compiled.text}) AS _openbase_query LIMIT ${limitPlaceholder}`

  return withConnection(filepath, async ({ all }) => {
    const rows = (await all(sql, [...compiled.values, limit])) as Record<string, unknown>[]
    const columns = rows.length ? Object.keys(rows[0]) : []
    return {
      rows,
      columns,
      rowCount: rows.length
    }
  })
}

export const listDuckDbTables = async (connection: Record<string, unknown>) => {
  const filepath = typeof connection.filepath === 'string' ? connection.filepath.trim() : ''
  if (!filepath) {
    throw createError({ statusCode: 400, statusMessage: 'DuckDB file path is required' })
  }

  return withConnection(filepath, async ({ all }) => {
    const rows = await all(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('information_schema', 'pg_catalog')
       ORDER BY table_schema, table_name`
    ) as Array<{ table_schema: string; table_name: string }>

    return rows.map((row) =>
      row.table_schema === 'main' ? row.table_name : `${row.table_schema}.${row.table_name}`
    )
  })
}

export const getDuckDbRows = async (
  connection: Record<string, unknown>,
  table: string,
  limit = 50
) => {
  const filepath = typeof connection.filepath === 'string' ? connection.filepath.trim() : ''
  if (!filepath) {
    throw createError({ statusCode: 400, statusMessage: 'DuckDB file path is required' })
  }

  const parsed = parseTableReference(table)
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 1000)) : 50

  return withConnection(filepath, async ({ all }) => {
    const exists = await all(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name = $2
       ) AS exists_flag`,
      [parsed.schema, parsed.table]
    ) as Array<{ exists_flag: boolean }>

    if (!exists[0]?.exists_flag) {
      throw createError({ statusCode: 404, statusMessage: 'Table not found' })
    }

    const sql =
      `SELECT * FROM ${quoteIdentifier(parsed.schema)}.${quoteIdentifier(parsed.table)} LIMIT $1`
    const rows = (await all(sql, [safeLimit])) as Record<string, unknown>[]
    const columns = rows.length ? Object.keys(rows[0]) : []

    return {
      columns,
      rows
    }
  })
}

export const testDuckDbConnection = async (connection: Record<string, unknown>) => {
  const tables = await listDuckDbTables(connection)
  return { ok: true, tables }
}
