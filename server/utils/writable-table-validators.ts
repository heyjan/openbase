import { createError } from 'h3'

const parseString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} is required` })
  }
  return value.trim()
}

const parseAllowedColumns = (value: unknown) => {
  if (value === undefined || value === null) {
    return null
  }

  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'allowed_columns must be an array or null'
    })
  }

  const columns = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)

  return Array.from(new Set(columns))
}

export const parseWritableTableCreateInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>

  return {
    dataSourceId: parseString(record.dataSourceId ?? record.data_source_id, 'dataSourceId'),
    tableName: parseString(record.tableName ?? record.table_name, 'tableName'),
    allowedColumns: parseAllowedColumns(record.allowedColumns ?? record.allowed_columns),
    allowInsert:
      typeof record.allowInsert === 'boolean'
        ? record.allowInsert
        : typeof record.allow_insert === 'boolean'
          ? record.allow_insert
          : true,
    allowUpdate:
      typeof record.allowUpdate === 'boolean'
        ? record.allowUpdate
        : typeof record.allow_update === 'boolean'
          ? record.allow_update
          : true,
    description:
      typeof record.description === 'string'
        ? record.description.trim() || null
        : null
  }
}

export const parseWritableTableUpdateInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const updates: Partial<{
    dataSourceId: string
    tableName: string
    allowedColumns: string[] | null
    allowInsert: boolean
    allowUpdate: boolean
    description: string | null
  }> = {}

  if (record.dataSourceId !== undefined || record.data_source_id !== undefined) {
    updates.dataSourceId = parseString(
      record.dataSourceId ?? record.data_source_id,
      'dataSourceId'
    )
  }

  if (record.tableName !== undefined || record.table_name !== undefined) {
    updates.tableName = parseString(record.tableName ?? record.table_name, 'tableName')
  }

  if (record.allowedColumns !== undefined || record.allowed_columns !== undefined) {
    updates.allowedColumns = parseAllowedColumns(
      record.allowedColumns ?? record.allowed_columns
    )
  }

  if (record.allowInsert !== undefined || record.allow_insert !== undefined) {
    const value = record.allowInsert ?? record.allow_insert
    if (typeof value !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'allowInsert must be boolean' })
    }
    updates.allowInsert = value
  }

  if (record.allowUpdate !== undefined || record.allow_update !== undefined) {
    const value = record.allowUpdate ?? record.allow_update
    if (typeof value !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'allowUpdate must be boolean' })
    }
    updates.allowUpdate = value
  }

  if (record.description !== undefined) {
    if (record.description !== null && typeof record.description !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'description must be string or null' })
    }
    updates.description =
      typeof record.description === 'string' ? record.description.trim() || null : null
  }

  return updates
}
