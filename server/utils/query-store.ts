import { createError } from 'h3'
import { query } from './db'

type SavedQueryRow = {
  id: string
  data_source_id: string
  name: string
  description: string | null
  query_text: string
  parameters: Record<string, unknown> | null
  created_at: string
  updated_at: string
  data_source_name?: string
}

export type SavedQueryRecord = {
  id: string
  dataSourceId: string
  dataSourceName?: string
  name: string
  description?: string
  queryText: string
  parameters: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const mapSavedQuery = (row: SavedQueryRow): SavedQueryRecord => ({
  id: row.id,
  dataSourceId: row.data_source_id,
  dataSourceName: row.data_source_name,
  name: row.name,
  description: row.description ?? undefined,
  queryText: row.query_text,
  parameters: row.parameters ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const isForeignKeyViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23503'

const toDataSourceError = (error: unknown) => {
  if (isForeignKeyViolation(error)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data source id' })
  }
  throw error
}

export const listSavedQueries = async (): Promise<SavedQueryRecord[]> => {
  const result = await query<SavedQueryRow>(
    `SELECT
       sq.id,
       sq.data_source_id,
       sq.name,
       sq.description,
       sq.query_text,
       sq.parameters,
       sq.created_at,
       sq.updated_at,
       ds.name AS data_source_name
     FROM saved_queries sq
     LEFT JOIN data_sources ds ON ds.id = sq.data_source_id
     ORDER BY sq.updated_at DESC`
  )
  return result.rows.map(mapSavedQuery)
}

export const getSavedQueryById = async (id: string): Promise<SavedQueryRecord> => {
  const result = await query<SavedQueryRow>(
    `SELECT
       sq.id,
       sq.data_source_id,
       sq.name,
       sq.description,
       sq.query_text,
       sq.parameters,
       sq.created_at,
       sq.updated_at,
       ds.name AS data_source_name
     FROM saved_queries sq
     LEFT JOIN data_sources ds ON ds.id = sq.data_source_id
     WHERE sq.id = $1`,
    [id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Saved query not found' })
  }
  return mapSavedQuery(row)
}

export const createSavedQuery = async (input: {
  dataSourceId: string
  name: string
  description?: string
  queryText: string
  parameters?: Record<string, unknown>
}): Promise<SavedQueryRecord> => {
  try {
    const result = await query<SavedQueryRow>(
      `INSERT INTO saved_queries (
         data_source_id,
         name,
         description,
         query_text,
         parameters
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, data_source_id, name, description, query_text, parameters, created_at, updated_at`,
      [
        input.dataSourceId,
        input.name,
        input.description ?? null,
        input.queryText,
        input.parameters ?? {}
      ]
    )
    return await getSavedQueryById(result.rows[0].id)
  } catch (error) {
    toDataSourceError(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to create saved query' })
}

export const updateSavedQuery = async (
  id: string,
  updates: Partial<{
    dataSourceId: string
    name: string
    description: string | null
    queryText: string
    parameters: Record<string, unknown>
  }>
): Promise<SavedQueryRecord> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.dataSourceId !== undefined) {
    fields.push(`data_source_id = $${index++}`)
    values.push(updates.dataSourceId)
  }
  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${index++}`)
    values.push(updates.description ?? null)
  }
  if (updates.queryText !== undefined) {
    fields.push(`query_text = $${index++}`)
    values.push(updates.queryText)
  }
  if (updates.parameters !== undefined) {
    fields.push(`parameters = $${index++}`)
    values.push(updates.parameters)
  }

  if (!fields.length) {
    return getSavedQueryById(id)
  }

  values.push(id)
  try {
    const result = await query<SavedQueryRow>(
      `UPDATE saved_queries
       SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${index}
       RETURNING id, data_source_id, name, description, query_text, parameters, created_at, updated_at`,
      values
    )
    const row = result.rows[0]
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Saved query not found' })
    }
    return await getSavedQueryById(row.id)
  } catch (error) {
    toDataSourceError(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to update saved query' })
}

export const deleteSavedQuery = async (id: string) => {
  const result = await query('DELETE FROM saved_queries WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Saved query not found' })
  }
}
