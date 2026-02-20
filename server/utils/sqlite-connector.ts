import Database from 'better-sqlite3'
import fs from 'fs'
import { createError } from 'h3'

const openDatabase = (filepath: string) => {
  if (!fs.existsSync(filepath)) {
    throw createError({ statusCode: 404, statusMessage: 'SQLite file not found' })
  }
  return new Database(filepath, { readonly: true, fileMustExist: true })
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

export const getSqliteRows = (filepath: string, table: string, limit = 50) => {
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

    const rows = db
      .prepare(`SELECT * FROM "${table.replace(/"/g, '""')}" LIMIT ?`)
      .all(limit)
    const columns = rows.length ? Object.keys(rows[0]) : []
    return { columns, rows }
  } finally {
    db.close()
  }
}

export const testSqliteConnection = (filepath: string) => {
  const tables = listSqliteTables(filepath)
  return { ok: true, tables }
}
