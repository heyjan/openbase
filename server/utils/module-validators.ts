import { createError } from 'h3'
import type {
  ModuleInput,
  ModuleLayoutUpdate,
  ModuleType,
  ModuleUpdate
} from '~/types/module'

const allowedTypes: ModuleType[] = [
  'time_series_chart',
  'outlier_table',
  'kpi_card',
  'data_table',
  'annotation_log',
  'form_input'
]

const parseNumber = (value: unknown, fallback: number) => {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid layout value' })
  }
  return value
}

export const parseModuleInput = (value: unknown): ModuleInput => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  if (typeof record.type !== 'string' || !allowedTypes.includes(record.type as ModuleType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid module type' })
  }

  return {
    type: record.type as ModuleType,
    title: typeof record.title === 'string' ? record.title.trim() : undefined,
    config:
      record.config && typeof record.config === 'object'
        ? (record.config as Record<string, unknown>)
        : undefined,
    gridX: parseNumber(record.gridX, 0),
    gridY: parseNumber(record.gridY, 0),
    gridW: parseNumber(record.gridW, 6),
    gridH: parseNumber(record.gridH, 4)
  }
}

export const parseModuleUpdate = (value: unknown): ModuleUpdate => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const updates: ModuleUpdate = {}

  if (record.title !== undefined) {
    if (typeof record.title !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid title' })
    }
    updates.title = record.title.trim()
  }

  if (record.config !== undefined) {
    if (!record.config || typeof record.config !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid config' })
    }
    updates.config = record.config as Record<string, unknown>
  }

  if (record.gridX !== undefined) updates.gridX = parseNumber(record.gridX, 0)
  if (record.gridY !== undefined) updates.gridY = parseNumber(record.gridY, 0)
  if (record.gridW !== undefined) updates.gridW = parseNumber(record.gridW, 6)
  if (record.gridH !== undefined) updates.gridH = parseNumber(record.gridH, 4)

  return updates
}

export const parseLayoutUpdate = (value: unknown): ModuleLayoutUpdate[] => {
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid layout payload' })
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid layout item' })
    }
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid module id' })
    }
    return {
      id: record.id,
      gridX: parseNumber(record.gridX, 0),
      gridY: parseNumber(record.gridY, 0),
      gridW: parseNumber(record.gridW, 6),
      gridH: parseNumber(record.gridH, 4)
    }
  })
}
