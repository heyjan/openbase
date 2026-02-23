import { createError } from 'h3'
import { parseVariableDefinitions } from '~~/shared/utils/query-variables'

const asRecord = (value: unknown, fieldName: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${fieldName}` })
  }
  return value as Record<string, unknown>
}

const parseRuntimeParameters = (value: unknown) => {
  if (value === undefined || value === null) {
    return {}
  }
  return asRecord(value, 'parameters')
}

const parseSavedQueryParameters = (value: unknown) => {
  const parameters = parseRuntimeParameters(value)
  try {
    const hasVariables = Object.prototype.hasOwnProperty.call(parameters, 'variables')
    const variables = parseVariableDefinitions(parameters)
    if (!hasVariables) {
      return parameters
    }
    return {
      ...parameters,
      variables
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid query parameters.variables'
    throw createError({ statusCode: 400, statusMessage: message })
  }
}

const parseString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} is required` })
  }
  return value.trim()
}

export const parseSavedQueryInput = (value: unknown) => {
  const record = asRecord(value, 'payload')

  const rawDataSourceId = record.dataSourceId ?? record.data_source_id
  const rawQueryText = record.queryText ?? record.query_text

  const dataSourceId = parseString(rawDataSourceId, 'data source id')
  const name = parseString(record.name, 'name')
  const queryText = parseString(rawQueryText, 'query text')

  const description =
    typeof record.description === 'string'
      ? record.description.trim() || undefined
      : undefined

  return {
    dataSourceId,
    name,
    description,
    queryText,
    parameters: parseSavedQueryParameters(record.parameters)
  }
}

export const parseSavedQueryUpdate = (value: unknown) => {
  const record = asRecord(value, 'payload')
  const updates: Partial<{
    dataSourceId: string
    name: string
    description: string | null
    queryText: string
    parameters: Record<string, unknown>
  }> = {}

  if (record.dataSourceId !== undefined || record.data_source_id !== undefined) {
    const rawDataSourceId = record.dataSourceId ?? record.data_source_id
    updates.dataSourceId = parseString(rawDataSourceId, 'data source id')
  }
  if (record.name !== undefined) {
    updates.name = parseString(record.name, 'name')
  }
  if (record.description !== undefined) {
    if (typeof record.description !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid description' })
    }
    updates.description = record.description.trim() || null
  }
  if (record.queryText !== undefined || record.query_text !== undefined) {
    const rawQueryText = record.queryText ?? record.query_text
    updates.queryText = parseString(rawQueryText, 'query text')
  }
  if (record.parameters !== undefined) {
    updates.parameters = parseSavedQueryParameters(record.parameters)
  }

  return updates
}

export const parseQueryRunInput = (value: unknown) => {
  if (value === undefined || value === null) {
    return {
      parameters: {} as Record<string, unknown>,
      limit: 100
    }
  }

  const record = asRecord(value, 'payload')
  const parameters = parseRuntimeParameters(record.parameters ?? record.filters)

  let limit = 100
  if (record.limit !== undefined) {
    if (typeof record.limit !== 'number' || Number.isNaN(record.limit)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid limit' })
    }
    const roundedLimit = Math.trunc(record.limit)
    if (roundedLimit < 1) {
      throw createError({ statusCode: 400, statusMessage: 'Limit must be greater than zero' })
    }
    limit = Math.min(roundedLimit, 1000)
  }

  return {
    parameters,
    limit
  }
}
