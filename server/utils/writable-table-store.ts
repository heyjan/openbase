import { createError } from 'h3'
import { query } from './db'

type WritableTableRow = {
  id: string
  data_source_id: string
  table_name: string
  allowed_columns: string[] | null
  allow_insert: boolean
  allow_update: boolean
  description: string | null
  created_at: string
  updated_at: string
  data_source_name?: string
  data_source_type?: string
}

export type WritableTableRecord = {
  id: string
  dataSourceId: string
  dataSourceName?: string
  dataSourceType?: string
  tableName: string
  allowedColumns: string[] | null
  allowInsert: boolean
  allowUpdate: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

const mapWritableTable = (row: WritableTableRow): WritableTableRecord => ({
  id: row.id,
  dataSourceId: row.data_source_id,
  dataSourceName: row.data_source_name,
  dataSourceType: row.data_source_type,
  tableName: row.table_name,
  allowedColumns: row.allowed_columns,
  allowInsert: row.allow_insert,
  allowUpdate: row.allow_update,
  description: row.description ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

const isForeignKeyViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23503'

const toWritableTableError = (error: unknown) => {
  if (isUniqueViolation(error)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Writable table already exists for this data source'
    })
  }
  if (isForeignKeyViolation(error)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data source id' })
  }
  throw error
}

export const listWritableTables = async (): Promise<WritableTableRecord[]> => {
  const result = await query<WritableTableRow>(
    `SELECT
       wt.id,
       wt.data_source_id,
       wt.table_name,
       wt.allowed_columns,
       wt.allow_insert,
       wt.allow_update,
       wt.description,
       wt.created_at,
       wt.updated_at,
       ds.name AS data_source_name,
       ds.type AS data_source_type
     FROM writable_tables wt
     JOIN data_sources ds ON ds.id = wt.data_source_id
     ORDER BY wt.updated_at DESC`
  )

  return result.rows.map(mapWritableTable)
}

export const getWritableTableById = async (
  id: string
): Promise<WritableTableRecord> => {
  const result = await query<WritableTableRow>(
    `SELECT
       wt.id,
       wt.data_source_id,
       wt.table_name,
       wt.allowed_columns,
       wt.allow_insert,
       wt.allow_update,
       wt.description,
       wt.created_at,
       wt.updated_at,
       ds.name AS data_source_name,
       ds.type AS data_source_type
     FROM writable_tables wt
     JOIN data_sources ds ON ds.id = wt.data_source_id
     WHERE wt.id = $1`,
    [id]
  )

  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Writable table not found' })
  }

  return mapWritableTable(row)
}

export const createWritableTable = async (input: {
  dataSourceId: string
  tableName: string
  allowedColumns: string[] | null
  allowInsert?: boolean
  allowUpdate?: boolean
  description?: string | null
}) => {
  try {
    const result = await query<WritableTableRow>(
      `INSERT INTO writable_tables (
         data_source_id,
         table_name,
         allowed_columns,
         allow_insert,
         allow_update,
         description
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, data_source_id, table_name, allowed_columns, allow_insert, allow_update, description, created_at, updated_at`,
      [
        input.dataSourceId,
        input.tableName,
        input.allowedColumns,
        input.allowInsert ?? true,
        input.allowUpdate ?? true,
        input.description ?? null
      ]
    )

    return getWritableTableById(result.rows[0].id)
  } catch (error) {
    toWritableTableError(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to create writable table' })
}

export const updateWritableTable = async (
  id: string,
  updates: Partial<{
    dataSourceId: string
    tableName: string
    allowedColumns: string[] | null
    allowInsert: boolean
    allowUpdate: boolean
    description: string | null
  }>
) => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.dataSourceId !== undefined) {
    fields.push(`data_source_id = $${index++}`)
    values.push(updates.dataSourceId)
  }
  if (updates.tableName !== undefined) {
    fields.push(`table_name = $${index++}`)
    values.push(updates.tableName)
  }
  if (updates.allowedColumns !== undefined) {
    fields.push(`allowed_columns = $${index++}`)
    values.push(updates.allowedColumns)
  }
  if (updates.allowInsert !== undefined) {
    fields.push(`allow_insert = $${index++}`)
    values.push(updates.allowInsert)
  }
  if (updates.allowUpdate !== undefined) {
    fields.push(`allow_update = $${index++}`)
    values.push(updates.allowUpdate)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${index++}`)
    values.push(updates.description)
  }

  if (!fields.length) {
    return getWritableTableById(id)
  }

  values.push(id)
  try {
    const result = await query<{ id: string }>(
      `UPDATE writable_tables
       SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${index}
       RETURNING id`,
      values
    )

    if (!result.rows[0]) {
      throw createError({ statusCode: 404, statusMessage: 'Writable table not found' })
    }

    return getWritableTableById(id)
  } catch (error) {
    toWritableTableError(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to update writable table' })
}

export const deleteWritableTable = async (id: string) => {
  const result = await query('DELETE FROM writable_tables WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Writable table not found' })
  }
}
