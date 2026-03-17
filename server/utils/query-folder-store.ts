import { createError } from 'h3'
import { query } from './db'

type QueryFolderRow = {
  id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type QueryFolderRecord = {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const mapQueryFolder = (row: QueryFolderRow): QueryFolderRecord => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const listQueryFolders = async (): Promise<QueryFolderRecord[]> => {
  const result = await query<QueryFolderRow>(
    `SELECT id, name, sort_order, created_at, updated_at
     FROM query_folders
     ORDER BY sort_order, name`
  )
  return result.rows.map(mapQueryFolder)
}

export const createQueryFolder = async (input: {
  name: string
}): Promise<QueryFolderRecord> => {
  const result = await query<QueryFolderRow>(
    `INSERT INTO query_folders (name)
     VALUES ($1)
     RETURNING id, name, sort_order, created_at, updated_at`,
    [input.name]
  )
  return mapQueryFolder(result.rows[0])
}

export const updateQueryFolder = async (
  id: string,
  updates: Partial<{ name: string; sortOrder: number }>
): Promise<QueryFolderRecord> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.sortOrder !== undefined) {
    fields.push(`sort_order = $${index++}`)
    values.push(updates.sortOrder)
  }

  if (!fields.length) {
    return getQueryFolderById(id)
  }

  values.push(id)
  const result = await query<QueryFolderRow>(
    `UPDATE query_folders
     SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${index}
     RETURNING id, name, sort_order, created_at, updated_at`,
    values
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Query folder not found' })
  }
  return mapQueryFolder(row)
}

const getQueryFolderById = async (id: string): Promise<QueryFolderRecord> => {
  const result = await query<QueryFolderRow>(
    `SELECT id, name, sort_order, created_at, updated_at
     FROM query_folders
     WHERE id = $1`,
    [id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Query folder not found' })
  }
  return mapQueryFolder(row)
}

export const deleteQueryFolder = async (id: string) => {
  const result = await query('DELETE FROM query_folders WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Query folder not found' })
  }
}
