import { createError } from 'h3'

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

export const parseQueryFolderInput = (value: unknown) => {
  const record = asRecord(value, 'payload')
  return {
    name: parseString(record.name, 'name')
  }
}

export const parseQueryFolderUpdate = (value: unknown) => {
  const record = asRecord(value, 'payload')
  const updates: Partial<{ name: string; sortOrder: number }> = {}

  if (record.name !== undefined) {
    updates.name = parseString(record.name, 'name')
  }
  if (record.sortOrder !== undefined) {
    if (typeof record.sortOrder !== 'number' || Number.isNaN(record.sortOrder)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sortOrder' })
    }
    updates.sortOrder = Math.trunc(record.sortOrder)
  }

  return updates
}
