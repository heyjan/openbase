import { createError } from 'h3'
import type { ModuleType } from '~/types/module'

const allowedModuleTypes: ModuleType[] = [
  'time_series_chart',
  'line_chart',
  'bar_chart',
  'pie_chart',
  'outlier_table',
  'kpi_card',
  'data_table',
  'annotation_log',
  'form_input'
]

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

const parseModuleType = (value: unknown): ModuleType => {
  if (typeof value !== 'string' || !allowedModuleTypes.includes(value as ModuleType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid module type' })
  }
  return value as ModuleType
}

const parseConfig = (value: unknown) => {
  if (value === undefined || value === null) {
    return {}
  }
  return asRecord(value, 'config')
}

export const parseModuleTemplateInput = (value: unknown) => {
  const record = asRecord(value, 'payload')

  return {
    name: parseString(record.name, 'name'),
    type: parseModuleType(record.type),
    config: parseConfig(record.config)
  }
}
