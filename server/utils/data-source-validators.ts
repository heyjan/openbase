import { createError } from 'h3'
import { resolveDataFilePath } from './data-path'

export type ParsedDataSourceInput = {
  name: string
  type: string
  connection: Record<string, unknown>
  is_active?: boolean
}

const asRecord = (value: unknown, fieldName: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${fieldName}` })
  }
  return value as Record<string, unknown>
}

const parseString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} is required` })
  }
  return value.trim()
}

const normalizeDataSourceType = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'postgres') {
    return 'postgresql'
  }
  return normalized
}

const hasConnectionUri = (connection: Record<string, unknown>) =>
  (typeof connection.connectionString === 'string' && connection.connectionString.trim()) ||
  (typeof connection.url === 'string' && connection.url.trim()) ||
  (typeof connection.uri === 'string' && connection.uri.trim())

const validateSqliteConnection = (connection: Record<string, unknown>) => {
  const filepath = parseString(connection.filepath, 'SQLite file path')
  return {
    filepath: resolveDataFilePath(filepath)
  }
}

const validateDuckDbConnection = (connection: Record<string, unknown>) => {
  const filepath = parseString(connection.filepath, 'DuckDB file path')
  return {
    filepath: resolveDataFilePath(filepath, { allowMemory: true })
  }
}

const validateMongoConnection = (connection: Record<string, unknown>) => {
  const uri = parseString(connection.uri, 'MongoDB URI')
  const database = parseString(connection.database, 'MongoDB database')
  return { uri, database }
}

const validatePostgresConnection = (connection: Record<string, unknown>) => {
  const uri = hasConnectionUri(connection)
  if (uri) {
    return {
      connectionString: String(uri)
    }
  }

  const host = parseString(connection.host, 'PostgreSQL host')
  const user = parseString(connection.user, 'PostgreSQL user')
  const database = parseString(connection.database, 'PostgreSQL database')

  const next: Record<string, unknown> = {
    host,
    user,
    database
  }

  if (typeof connection.port === 'number' && Number.isFinite(connection.port)) {
    next.port = Math.trunc(connection.port)
  }
  if (typeof connection.password === 'string') {
    next.password = connection.password
  }

  return next
}

const validateMySqlConnection = (connection: Record<string, unknown>) => {
  const uri = hasConnectionUri(connection)
  if (uri) {
    return {
      uri: String(uri)
    }
  }

  const host = parseString(connection.host, 'MySQL host')
  const user = parseString(connection.user, 'MySQL user')
  const database = parseString(connection.database, 'MySQL database')

  const next: Record<string, unknown> = {
    host,
    user,
    database
  }

  if (typeof connection.port === 'number' && Number.isFinite(connection.port)) {
    next.port = Math.trunc(connection.port)
  }
  if (typeof connection.password === 'string') {
    next.password = connection.password
  }

  return next
}

const validateConnectionByType = (
  type: string,
  connection: Record<string, unknown>
) => {
  if (type === 'sqlite') {
    return validateSqliteConnection(connection)
  }
  if (type === 'duckdb') {
    return validateDuckDbConnection(connection)
  }
  if (type === 'mongodb') {
    return validateMongoConnection(connection)
  }
  if (type === 'postgresql') {
    return validatePostgresConnection(connection)
  }
  if (type === 'mysql') {
    return validateMySqlConnection(connection)
  }

  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type' })
}

export const parseDataSourceInput = (value: unknown): ParsedDataSourceInput => {
  const record = asRecord(value, 'payload')

  const name = parseString(record.name, 'Name')
  const type = normalizeDataSourceType(parseString(record.type, 'Type'))
  const rawConnection = asRecord(record.connection ?? {}, 'connection')
  const connection = validateConnectionByType(type, rawConnection)

  return {
    name,
    type,
    connection,
    is_active: typeof record.is_active === 'boolean' ? record.is_active : true
  }
}

export const parseDataSourceUpdate = (value: unknown) => {
  const record = asRecord(value, 'payload')

  const updates: {
    name?: string
    connection?: Record<string, unknown>
    is_active?: boolean
  } = {}

  if (record.name !== undefined) {
    updates.name = parseString(record.name, 'Name')
  }

  if (record.connection !== undefined) {
    const connection = asRecord(record.connection, 'connection')
    const normalized = { ...connection }

    if (normalized.filepath !== undefined) {
      if (typeof normalized.filepath !== 'string' || !normalized.filepath.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid connection.filepath' })
      }
      normalized.filepath = resolveDataFilePath(normalized.filepath, {
        allowMemory: normalized.filepath.trim() === ':memory:'
      })
    }

    for (const key of ['uri', 'url', 'connectionString', 'host', 'user', 'database']) {
      if (normalized[key] !== undefined) {
        if (typeof normalized[key] !== 'string' || !String(normalized[key]).trim()) {
          throw createError({ statusCode: 400, statusMessage: `Invalid connection.${key}` })
        }
        normalized[key] = String(normalized[key]).trim()
      }
    }

    if (normalized.port !== undefined) {
      if (typeof normalized.port !== 'number' || !Number.isFinite(normalized.port)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid connection.port' })
      }
      normalized.port = Math.trunc(normalized.port)
    }

    updates.connection = normalized
  }

  if (record.is_active !== undefined) {
    if (typeof record.is_active !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid is_active value' })
    }
    updates.is_active = record.is_active
  }

  return updates
}
