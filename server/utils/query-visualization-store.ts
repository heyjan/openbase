import { createError } from 'h3'
import type { ModuleType } from '~/types/module'
import { query } from './db'

type QueryVisualizationRow = {
  id: string
  saved_query_id: string
  saved_query_name: string
  name: string
  module_type: ModuleType
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type QueryVisualizationRecord = {
  id: string
  savedQueryId: string
  savedQueryName: string
  name: string
  moduleType: ModuleType
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const mapQueryVisualization = (
  row: QueryVisualizationRow
): QueryVisualizationRecord => ({
  id: row.id,
  savedQueryId: row.saved_query_id,
  savedQueryName: row.saved_query_name,
  name: row.name,
  moduleType: row.module_type,
  config: row.config ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const isForeignKeyViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23503'

const toSavedQueryError = (error: unknown) => {
  if (isForeignKeyViolation(error)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid saved query id' })
  }
  throw error
}

const selectBase = `SELECT
  qv.id,
  qv.saved_query_id,
  sq.name AS saved_query_name,
  qv.name,
  qv.module_type,
  qv.config,
  qv.created_at,
  qv.updated_at
 FROM query_visualizations qv
 JOIN saved_queries sq ON sq.id = qv.saved_query_id`

export const listQueryVisualizations = async (input?: {
  savedQueryId?: string
}): Promise<QueryVisualizationRecord[]> => {
  if (input?.savedQueryId) {
    const result = await query<QueryVisualizationRow>(
      `${selectBase}
       WHERE qv.saved_query_id = $1
       ORDER BY qv.updated_at DESC, qv.created_at DESC`,
      [input.savedQueryId]
    )
    return result.rows.map(mapQueryVisualization)
  }

  const result = await query<QueryVisualizationRow>(
    `${selectBase}
     ORDER BY qv.updated_at DESC, qv.created_at DESC`
  )
  return result.rows.map(mapQueryVisualization)
}

export const getQueryVisualizationById = async (
  id: string
): Promise<QueryVisualizationRecord> => {
  const result = await query<QueryVisualizationRow>(
    `${selectBase}
     WHERE qv.id = $1`,
    [id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Query visualization not found' })
  }
  return mapQueryVisualization(row)
}

export const createQueryVisualization = async (input: {
  savedQueryId: string
  name: string
  moduleType: ModuleType
  config?: Record<string, unknown>
}): Promise<QueryVisualizationRecord> => {
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO query_visualizations (
         saved_query_id,
         name,
         module_type,
         config
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.savedQueryId, input.name, input.moduleType, input.config ?? {}]
    )
    return await getQueryVisualizationById(result.rows[0].id)
  } catch (error) {
    toSavedQueryError(error)
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to create query visualization'
  })
}

export const updateQueryVisualization = async (
  id: string,
  updates: Partial<{
    savedQueryId: string
    name: string
    moduleType: ModuleType
    config: Record<string, unknown>
  }>
): Promise<QueryVisualizationRecord> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.savedQueryId !== undefined) {
    fields.push(`saved_query_id = $${index++}`)
    values.push(updates.savedQueryId)
  }
  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.moduleType !== undefined) {
    fields.push(`module_type = $${index++}`)
    values.push(updates.moduleType)
  }
  if (updates.config !== undefined) {
    fields.push(`config = $${index++}`)
    values.push(updates.config)
  }

  if (!fields.length) {
    return getQueryVisualizationById(id)
  }

  values.push(id)

  try {
    const result = await query<{ id: string }>(
      `UPDATE query_visualizations
       SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${index}
       RETURNING id`,
      values
    )

    const row = result.rows[0]
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Query visualization not found' })
    }

    return await getQueryVisualizationById(row.id)
  } catch (error) {
    toSavedQueryError(error)
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to update query visualization'
  })
}

export const deleteQueryVisualization = async (id: string) => {
  const result = await query('DELETE FROM query_visualizations WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Query visualization not found' })
  }
}
