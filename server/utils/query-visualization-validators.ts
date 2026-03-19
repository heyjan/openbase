import { createError } from 'h3'
import type { ModuleType } from '~/types/module'

const allowedModuleTypes: ModuleType[] = [
  'time_series_chart',
  'line_chart',
  'bar_chart',
  'stacked_horizontal_bar_chart',
  'waterfall_chart',
  'radar_chart',
  'scatter_chart',
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid config' })
  }
  return value as Record<string, unknown>
}

export const parseQueryVisualizationInput = (value: unknown) => {
  const record = asRecord(value, 'payload')

  const rawSavedQueryId = record.savedQueryId ?? record.saved_query_id
  const rawModuleType = record.moduleType ?? record.module_type

  return {
    savedQueryId: parseString(rawSavedQueryId, 'saved query id'),
    folderId: record.folderId === undefined && record.folder_id === undefined
      ? undefined
      : (
          record.folderId === null || record.folder_id === null
            ? null
            : parseString(record.folderId ?? record.folder_id, 'folder id')
        ),
    name: parseString(record.name, 'name'),
    moduleType: parseModuleType(rawModuleType),
    config: parseConfig(record.config)
  }
}

export const parseQueryVisualizationUpdate = (value: unknown) => {
  const record = asRecord(value, 'payload')
  const updates: Partial<{
    savedQueryId: string
    folderId: string | null
    name: string
    moduleType: ModuleType
    config: Record<string, unknown>
  }> = {}

  if (record.savedQueryId !== undefined || record.saved_query_id !== undefined) {
    updates.savedQueryId = parseString(
      record.savedQueryId ?? record.saved_query_id,
      'saved query id'
    )
  }

  if (record.folderId !== undefined || record.folder_id !== undefined) {
    const rawFolderId = record.folderId ?? record.folder_id
    updates.folderId = rawFolderId === null ? null : parseString(rawFolderId, 'folder id')
  }

  if (record.name !== undefined) {
    updates.name = parseString(record.name, 'name')
  }

  if (record.moduleType !== undefined || record.module_type !== undefined) {
    updates.moduleType = parseModuleType(record.moduleType ?? record.module_type)
  }

  if (record.config !== undefined) {
    updates.config = parseConfig(record.config)
  }

  return updates
}

export const parseQueryVisualizationListInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const record = value as Record<string, unknown>
  const rawSavedQueryId = record.savedQueryId ?? record.saved_query_id

  if (rawSavedQueryId === undefined) {
    return {}
  }

  return {
    savedQueryId: parseString(rawSavedQueryId, 'saved query id')
  }
}
