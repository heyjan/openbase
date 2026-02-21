import { createError } from 'h3'
import { query } from './db'

export type DataSourceRecord = {
  id: string
  name: string
  type: string
  connection: Record<string, unknown>
  is_active: boolean
  created_at: string
  last_sync_at: string | null
}

export const listDataSources = async (): Promise<DataSourceRecord[]> => {
  const result = await query<DataSourceRecord>(
    `SELECT id, name, type, connection, is_active, created_at, last_sync_at
     FROM data_sources
     ORDER BY created_at DESC`
  )
  return result.rows
}

export const getDataSourceById = async (id: string): Promise<DataSourceRecord> => {
  const result = await query<DataSourceRecord>(
    `SELECT id, name, type, connection, is_active, created_at, last_sync_at
     FROM data_sources
     WHERE id = $1`,
    [id]
  )
  const record = result.rows[0]
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Data source not found' })
  }
  return record
}

export const createDataSource = async (
  name: string,
  type: string,
  connection: Record<string, unknown>,
  isActive = true
): Promise<DataSourceRecord> => {
  const result = await query<DataSourceRecord>(
    `INSERT INTO data_sources (name, type, connection, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, type, connection, is_active, created_at, last_sync_at`,
    [name, type, connection, isActive]
  )
  return result.rows[0]
}

export const updateDataSource = async (
  id: string,
  updates: Partial<Pick<DataSourceRecord, 'name' | 'connection' | 'is_active'>>
): Promise<DataSourceRecord> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.connection !== undefined) {
    fields.push(`connection = $${index++}`)
    values.push(updates.connection)
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${index++}`)
    values.push(updates.is_active)
  }

  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'No updates provided' })
  }

  values.push(id)
  const result = await query<DataSourceRecord>(
    `UPDATE data_sources
     SET ${fields.join(', ')}
     WHERE id = $${index}
     RETURNING id, name, type, connection, is_active, created_at, last_sync_at`,
    values
  )
  const record = result.rows[0]
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Data source not found' })
  }
  return record
}

export const deleteDataSource = async (id: string) => {
  try {
    const result = await query('DELETE FROM data_sources WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Data source not found' })
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23503'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Data source is in use by one or more saved queries. Remove those queries first.'
      })
    }
    throw error
  }
}
