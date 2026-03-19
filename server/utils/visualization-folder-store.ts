import { createError } from 'h3'
import { query } from './db'

type VisualizationFolderRow = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type VisualizationFolderRecord = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

const mapVisualizationFolder = (row: VisualizationFolderRow): VisualizationFolderRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const listVisualizationFolders = async (): Promise<VisualizationFolderRecord[]> => {
  const result = await query<VisualizationFolderRow>(
    `SELECT id, name, created_at, updated_at
     FROM visualization_folders
     ORDER BY name`
  )
  return result.rows.map(mapVisualizationFolder)
}

export const createVisualizationFolder = async (input: {
  name: string
}): Promise<VisualizationFolderRecord> => {
  const result = await query<VisualizationFolderRow>(
    `INSERT INTO visualization_folders (name)
     VALUES ($1)
     RETURNING id, name, created_at, updated_at`,
    [input.name]
  )
  return mapVisualizationFolder(result.rows[0])
}

export const updateVisualizationFolder = async (
  id: string,
  updates: Partial<{ name: string }>
): Promise<VisualizationFolderRecord> => {
  if (updates.name === undefined) {
    return getVisualizationFolderById(id)
  }

  const result = await query<VisualizationFolderRow>(
    `UPDATE visualization_folders
     SET name = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, created_at, updated_at`,
    [updates.name, id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Visualization folder not found' })
  }
  return mapVisualizationFolder(row)
}

const getVisualizationFolderById = async (id: string): Promise<VisualizationFolderRecord> => {
  const result = await query<VisualizationFolderRow>(
    `SELECT id, name, created_at, updated_at
     FROM visualization_folders
     WHERE id = $1`,
    [id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Visualization folder not found' })
  }
  return mapVisualizationFolder(row)
}

export const deleteVisualizationFolder = async (id: string) => {
  const result = await query('DELETE FROM visualization_folders WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Visualization folder not found' })
  }
}
