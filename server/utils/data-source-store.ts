import { createError } from 'h3'
import { query } from './db'
import { decryptConnection, encryptConnection, isConnectionEncryptionEnabled } from './crypto'

type DataSourceRow = {
  id: string
  name: string
  type: string
  connection: unknown
  connection_encrypted: boolean
  is_active: boolean
  created_at: string
  last_sync_at: string | null
}

export type DataSourceRecord = {
  id: string
  name: string
  type: string
  connection: Record<string, unknown>
  is_active: boolean
  created_at: string
  last_sync_at: string | null
}

let dataSourceSchemaReady = false
let dataSourceSchemaReadyPromise: Promise<void> | null = null

const ensureDataSourceSchema = async () => {
  if (dataSourceSchemaReady) {
    return
  }

  if (dataSourceSchemaReadyPromise) {
    await dataSourceSchemaReadyPromise
    return
  }

  dataSourceSchemaReadyPromise = (async () => {
    await query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'data_sources'
             AND column_name = 'connection_encrypted'
         ) THEN
           ALTER TABLE data_sources
           ADD COLUMN connection_encrypted BOOLEAN NOT NULL DEFAULT false;
         END IF;
       END $$;`
    )

    dataSourceSchemaReady = true
  })()

  try {
    await dataSourceSchemaReadyPromise
  } finally {
    dataSourceSchemaReadyPromise = null
  }
}

const mapDataSource = (row: DataSourceRow): DataSourceRecord => ({
  id: row.id,
  name: row.name,
  type: row.type,
  connection: decryptConnection(row.connection, row.connection_encrypted),
  is_active: row.is_active,
  created_at: row.created_at,
  last_sync_at: row.last_sync_at
})

export const listDataSources = async (): Promise<DataSourceRecord[]> => {
  await ensureDataSourceSchema()

  const result = await query<DataSourceRow>(
    `SELECT id, name, type, connection, connection_encrypted, is_active, created_at, last_sync_at
     FROM data_sources
     ORDER BY created_at DESC`
  )
  return result.rows.map(mapDataSource)
}

export const getDataSourceById = async (id: string): Promise<DataSourceRecord> => {
  await ensureDataSourceSchema()

  const result = await query<DataSourceRow>(
    `SELECT id, name, type, connection, connection_encrypted, is_active, created_at, last_sync_at
     FROM data_sources
     WHERE id = $1`,
    [id]
  )
  const record = result.rows[0]
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Data source not found' })
  }
  return mapDataSource(record)
}

export const createDataSource = async (
  name: string,
  type: string,
  connection: Record<string, unknown>,
  isActive = true
): Promise<DataSourceRecord> => {
  await ensureDataSourceSchema()

  const storedConnection = encryptConnection(connection)
  const result = await query<DataSourceRow>(
    `INSERT INTO data_sources (name, type, connection, connection_encrypted, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, type, connection, connection_encrypted, is_active, created_at, last_sync_at`,
    [
      name,
      type,
      storedConnection.connection,
      storedConnection.connectionEncrypted,
      isActive
    ]
  )
  return mapDataSource(result.rows[0])
}

export const updateDataSource = async (
  id: string,
  updates: Partial<Pick<DataSourceRecord, 'name' | 'connection' | 'is_active'>>
): Promise<DataSourceRecord> => {
  await ensureDataSourceSchema()

  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.connection !== undefined) {
    const storedConnection = encryptConnection(updates.connection)
    fields.push(`connection = $${index++}`)
    values.push(storedConnection.connection)
    fields.push(`connection_encrypted = $${index++}`)
    values.push(storedConnection.connectionEncrypted)
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${index++}`)
    values.push(updates.is_active)
  }

  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'No updates provided' })
  }

  values.push(id)
  const result = await query<DataSourceRow>(
    `UPDATE data_sources
     SET ${fields.join(', ')}
     WHERE id = $${index}
     RETURNING id, name, type, connection, connection_encrypted, is_active, created_at, last_sync_at`,
    values
  )
  const record = result.rows[0]
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Data source not found' })
  }
  return mapDataSource(record)
}

export const migrateDataSourceConnectionsToEncrypted = async () => {
  await ensureDataSourceSchema()

  if (!isConnectionEncryptionEnabled()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'OPENBASE_ENCRYPTION_KEY is required to migrate connections'
    })
  }

  const result = await query<DataSourceRow>(
    `SELECT id, name, type, connection, connection_encrypted, is_active, created_at, last_sync_at
     FROM data_sources
     WHERE connection_encrypted = false`
  )

  for (const row of result.rows) {
    const decryptedConnection = decryptConnection(row.connection, false)
    const encryptedConnection = encryptConnection(decryptedConnection)
    await query(
      `UPDATE data_sources
       SET connection = $1, connection_encrypted = $2
       WHERE id = $3`,
      [encryptedConnection.connection, encryptedConnection.connectionEncrypted, row.id]
    )
  }

  return {
    migrated: result.rows.length
  }
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
