import { createError } from 'h3'

export type ParsedDataSourceInput = {
  name: string
  type: string
  connection: Record<string, unknown>
  is_active?: boolean
}

export const parseDataSourceInput = (value: unknown): ParsedDataSourceInput => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const type = typeof record.type === 'string' ? record.type.trim() : ''
  const connection =
    record.connection && typeof record.connection === 'object'
      ? (record.connection as Record<string, unknown>)
      : {}

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!type) {
    throw createError({ statusCode: 400, statusMessage: 'Type is required' })
  }

  if (type === 'sqlite') {
    const filepath = connection.filepath
    if (typeof filepath !== 'string' || !filepath.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'SQLite file path required' })
    }
  } else if (type === 'mongodb') {
    const uri = connection.uri
    const database = connection.database
    if (typeof uri !== 'string' || !uri.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'MongoDB URI required' })
    }
    if (typeof database !== 'string' || !database.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'MongoDB database required' })
    }
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
  }

  return {
    name,
    type,
    connection,
    is_active: typeof record.is_active === 'boolean' ? record.is_active : true
  }
}

export const parseDataSourceUpdate = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const updates: {
    name?: string
    connection?: Record<string, unknown>
    is_active?: boolean
  } = {}

  if (record.name !== undefined) {
    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    }
    updates.name = record.name.trim()
  }

  if (record.connection !== undefined) {
    if (!record.connection || typeof record.connection !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid connection' })
    }
    const connection = record.connection as Record<string, unknown>
    if (connection.filepath !== undefined) {
      if (typeof connection.filepath !== 'string' || !connection.filepath.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: 'SQLite file path required'
        })
      }
    }
    if (connection.uri !== undefined) {
      if (typeof connection.uri !== 'string' || !connection.uri.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'MongoDB URI required' })
      }
    }
    if (connection.database !== undefined) {
      if (typeof connection.database !== 'string' || !connection.database.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: 'MongoDB database required'
        })
      }
    }
    updates.connection = connection
  }

  if (record.is_active !== undefined) {
    if (typeof record.is_active !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid is_active value' })
    }
    updates.is_active = record.is_active
  }

  return updates
}
