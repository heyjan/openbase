import type { DataSourceRecord } from './data-source-store'

const URI_KEYS = new Set(['connectionstring', 'uri', 'url'])
const SECRET_KEY_PATTERN = /(pass(word)?|secret|token|api[_-]?key|private[_-]?key|access[_-]?token)/i

const stripCredentialsFromConnectionUri = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const parsed = new URL(trimmed)
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return trimmed
      .replace(/\/\/[^/@]*@/, '//')
      .replace(/[?#].*$/, '')
  }
}

const sanitizeConnectionValue = (key: string, value: unknown): unknown => {
  const normalizedKey = key.toLowerCase()

  if (SECRET_KEY_PATTERN.test(key)) {
    return undefined
  }

  if (typeof value === 'string') {
    if (URI_KEYS.has(normalizedKey)) {
      return stripCredentialsFromConnectionUri(value)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeConnectionValue('', item))
      .filter((item) => item !== undefined)
  }

  if (value && typeof value === 'object') {
    return sanitizeConnection(value as Record<string, unknown>)
  }

  return value
}

export const sanitizeConnection = (connection: Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(connection)) {
    const nextValue = sanitizeConnectionValue(key, value)
    if (nextValue !== undefined) {
      sanitized[key] = nextValue
    }
  }

  return sanitized
}

export const toPublicDataSource = (record: DataSourceRecord): DataSourceRecord => ({
  ...record,
  connection: sanitizeConnection(record.connection)
})

export const toPublicDataSources = (records: DataSourceRecord[]) =>
  records.map(toPublicDataSource)
