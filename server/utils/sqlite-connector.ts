import Database from 'better-sqlite3'
import fs from 'fs'
import { createError } from 'h3'
import { resolveDataFilePath } from './data-path'

type DataBrowserRowsOptions = {
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

const openDatabase = (filepath: string) => {
  const resolvedPath = resolveDataFilePath(filepath)
  if (!fs.existsSync(resolvedPath)) {
    throw createError({ statusCode: 404, statusMessage: 'SQLite file not found' })
  }
  return new Database(resolvedPath, { readonly: true, fileMustExist: true })
}

export const listSqliteTables = (filepath: string) => {
  const db = openDatabase(filepath)
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((row) => row.name as string)
    return tables
  } finally {
    db.close()
  }
}

export const getSqliteRows = (
  filepath: string,
  table: string,
  limit = 50,
  options: DataBrowserRowsOptions = {}
) => {
  const db = openDatabase(filepath)
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((row) => row.name as string)

    if (!tables.includes(table)) {
      throw createError({ statusCode: 404, statusMessage: 'Table not found' })
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 1000)) : 50
    const safeOffset =
      typeof options.offset === 'number' && Number.isFinite(options.offset)
        ? Math.max(0, Math.trunc(options.offset))
        : 0
    const safeSortDir = options.sortDir === 'desc' ? 'DESC' : 'ASC'

    const escapedTable = table.replace(/"/g, '""')
    const columns = db
      .prepare(`PRAGMA table_info("${escapedTable}")`)
      .all()
      .map((row) => String(row.name))
    const sortColumn = options.sortBy?.trim()

    if (sortColumn && !columns.includes(sortColumn)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sort column' })
    }

    const orderBySql = sortColumn
      ? ` ORDER BY "${sortColumn.replace(/"/g, '""')}" ${safeSortDir}`
      : ''

    const rows = db
      .prepare(`SELECT * FROM "${escapedTable}"${orderBySql} LIMIT ? OFFSET ?`)
      .all(safeLimit, safeOffset)

    return { columns, rows }
  } finally {
    db.close()
  }
}

export const testSqliteConnection = (filepath: string) => {
  const tables = listSqliteTables(filepath)
  return { ok: true, tables }
}

export const runSqliteQuery = (
  filepath: string,
  queryText: string,
  parameters: Record<string, unknown>,
  limit: number
) => {
  const db = openDatabase(filepath)
  try {
    const cleanedQuery = queryText.trim().replace(/;\s*$/, '')
    // SQLite does not support PostgreSQL-style casts like `value::numeric`.
    // Strip the cast suffix to keep common cross-database queries working.
    const sqliteCompatibleQuery = cleanedQuery.replace(
      /\s*::\s*(?:"[^"]+"|[a-zA-Z_][a-zA-Z0-9_.]*)/g,
      ''
    )

    const wrappedQuery = `SELECT * FROM (${sqliteCompatibleQuery}) AS _openbase_query LIMIT $__openbase_limit_internal`
    const statement = db.prepare(wrappedQuery)
    const rows = statement.all({
      ...parameters,
      __openbase_limit_internal: limit
    }) as Record<string, unknown>[]
    const columns =
      rows.length > 0
        ? Object.keys(rows[0])
        : statement.columns().map((column) => String(column.name))
    return {
      rows,
      columns,
      rowCount: rows.length
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run SQLite query'
    throw createError({
      statusCode: 400,
      statusMessage: message
    })
  } finally {
    db.close()
  }
}
