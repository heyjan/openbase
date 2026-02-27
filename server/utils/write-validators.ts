import { createError } from 'h3'
import type { TableColumnSchema } from './table-schema'

const INTEGER_TYPES = new Set(['integer', 'smallint'])
const BIGINT_TYPES = new Set(['bigint'])
const NUMERIC_TYPES = new Set(['numeric', 'decimal', 'real', 'double precision'])
const STRING_TYPES = new Set([
  'text',
  'character varying',
  'character',
  'varchar',
  'bpchar',
  'citext'
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const INTEGER_PATTERN = /^-?\d+$/
const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/

const normalizeColumnName = (value: string) => value.trim().toLowerCase()

const asRecord = (value: unknown, fieldName: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be an object` })
  }
  return value as Record<string, unknown>
}

const validateBoolean = (value: unknown, columnName: string) => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  throw createError({ statusCode: 400, statusMessage: `${columnName} must be boolean` })
}

const validateValueForColumn = (
  value: unknown,
  schema: TableColumnSchema
): unknown => {
  const columnName = schema.columnName

  if (value === null) {
    if (!schema.isNullable) {
      throw createError({
        statusCode: 400,
        statusMessage: `${columnName} cannot be null`
      })
    }
    return null
  }

  if (INTEGER_TYPES.has(schema.dataType)) {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value
    }
    if (typeof value === 'string' && INTEGER_PATTERN.test(value.trim())) {
      return Number(value)
    }
    throw createError({ statusCode: 400, statusMessage: `${columnName} must be an integer` })
  }

  if (BIGINT_TYPES.has(schema.dataType)) {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return String(value)
    }
    if (typeof value === 'string' && INTEGER_PATTERN.test(value.trim())) {
      return value.trim()
    }
    throw createError({ statusCode: 400, statusMessage: `${columnName} must be an integer` })
  }

  if (NUMERIC_TYPES.has(schema.dataType)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && NUMERIC_PATTERN.test(value.trim())) {
      return Number(value)
    }
    throw createError({ statusCode: 400, statusMessage: `${columnName} must be numeric` })
  }

  if (schema.dataType === 'boolean') {
    return validateBoolean(value, columnName)
  }

  if (schema.dataType === 'date') {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
      throw createError({ statusCode: 400, statusMessage: `${columnName} must be YYYY-MM-DD` })
    }
    return value.trim()
  }

  if (schema.dataType === 'uuid') {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
      throw createError({ statusCode: 400, statusMessage: `${columnName} must be a UUID` })
    }
    return value.trim()
  }

  if (STRING_TYPES.has(schema.dataType)) {
    if (typeof value !== 'string') {
      throw createError({ statusCode: 400, statusMessage: `${columnName} must be a string` })
    }

    if (schema.maxLength !== null && value.length > schema.maxLength) {
      throw createError({
        statusCode: 400,
        statusMessage: `${columnName} exceeds max length ${schema.maxLength}`
      })
    }

    return value
  }

  if (schema.dataType === 'json' || schema.dataType === 'jsonb') {
    return value
  }

  if (schema.dataType.startsWith('timestamp') || schema.dataType.startsWith('time')) {
    if (typeof value !== 'string' || !value.trim()) {
      throw createError({ statusCode: 400, statusMessage: `${columnName} must be a date/time string` })
    }
    return value.trim()
  }

  return value
}

export const validateWriteValues = (input: {
  values: unknown
  schema: TableColumnSchema[]
  allowedColumns: string[] | null
}) => {
  const valueRecord = asRecord(input.values, 'values')
  const allowedColumnsSet = input.allowedColumns
    ? new Set(input.allowedColumns.map(normalizeColumnName))
    : null

  const schemaByName = new Map(
    input.schema.map((column) => [normalizeColumnName(column.columnName), column])
  )

  const validatedColumns: string[] = []
  const validatedValues: unknown[] = []

  for (const [rawColumnName, rawValue] of Object.entries(valueRecord)) {
    const normalizedColumnName = normalizeColumnName(rawColumnName)

    if (allowedColumnsSet && !allowedColumnsSet.has(normalizedColumnName)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Column not writable: ${rawColumnName}`
      })
    }

    const columnSchema = schemaByName.get(normalizedColumnName)
    if (!columnSchema) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown column: ${rawColumnName}`
      })
    }

    const validatedValue = validateValueForColumn(rawValue, columnSchema)
    validatedColumns.push(columnSchema.columnName)
    validatedValues.push(validatedValue)
  }

  if (!validatedColumns.length) {
    throw createError({ statusCode: 400, statusMessage: 'No values provided' })
  }

  return {
    columns: validatedColumns,
    values: validatedValues
  }
}

export const validateWhereValues = (input: {
  where: unknown
  schema: TableColumnSchema[]
}) => {
  const whereRecord = asRecord(input.where, 'where')
  const schemaByName = new Map(
    input.schema.map((column) => [normalizeColumnName(column.columnName), column])
  )

  const columns: string[] = []
  const values: unknown[] = []

  for (const [rawColumnName, rawValue] of Object.entries(whereRecord)) {
    const columnSchema = schemaByName.get(normalizeColumnName(rawColumnName))
    if (!columnSchema) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown where column: ${rawColumnName}`
      })
    }

    const validatedValue = validateValueForColumn(rawValue, columnSchema)
    if (validatedValue === null) {
      throw createError({
        statusCode: 400,
        statusMessage: `where.${columnSchema.columnName} cannot be null`
      })
    }

    columns.push(columnSchema.columnName)
    values.push(validatedValue)
  }

  if (!columns.length) {
    throw createError({ statusCode: 400, statusMessage: 'Where clause is required' })
  }

  return {
    columns,
    values
  }
}
