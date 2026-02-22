import { createError } from 'h3'
import {
  isTextModuleType,
  type ModuleInput,
  type ModuleLayoutUpdate,
  type ModuleType,
  type ModuleUpdate,
  type TextModuleType
} from '~/types/module'

const allowedTypes: ModuleType[] = [
  'time_series_chart',
  'line_chart',
  'bar_chart',
  'pie_chart',
  'outlier_table',
  'kpi_card',
  'data_table',
  'annotation_log',
  'form_input',
  'header',
  'subheader'
]

const FONT_SIZE_PRESETS = ['M', 'L', 'XL'] as const
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

const textModuleDefaults: Record<
  TextModuleType,
  { text: string; fontSize: (typeof FONT_SIZE_PRESETS)[number]; color: string }
> = {
  header: {
    text: 'Section Title',
    fontSize: 'L',
    color: '#1a1a1a'
  },
  subheader: {
    text: 'Subsection',
    fontSize: 'M',
    color: '#6b7280'
  }
}

const parseNumber = (value: unknown, fallback: number) => {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid layout value' })
  }
  return value
}

const parseOptionalString = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${fieldName}` })
  }
  return value.trim() || null
}

const parseModuleConfig = (type: ModuleType, value: unknown) => {
  if (!isTextModuleType(type)) {
    if (value === undefined) {
      return undefined
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid config' })
    }
    return value as Record<string, unknown>
  }

  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid config' })
  }

  const defaults = textModuleDefaults[type]
  const record = (value ?? {}) as Record<string, unknown>

  const text = record.text
  const fontSize = record.fontSize
  const color = record.color

  const normalizedText =
    text === undefined
      ? defaults.text
      : typeof text === 'string' && text.trim()
        ? text.trim()
        : null
  if (!normalizedText) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid config text' })
  }

  const normalizedFontSize =
    fontSize === undefined
      ? defaults.fontSize
      : typeof fontSize === 'string' &&
          FONT_SIZE_PRESETS.includes(fontSize as (typeof FONT_SIZE_PRESETS)[number])
        ? (fontSize as (typeof FONT_SIZE_PRESETS)[number])
        : null
  if (!normalizedFontSize) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid config font size' })
  }

  const normalizedColor =
    color === undefined
      ? defaults.color
      : typeof color === 'string' && HEX_COLOR_REGEX.test(color)
        ? color
        : null
  if (!normalizedColor) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid config color' })
  }

  return {
    text: normalizedText,
    fontSize: normalizedFontSize,
    color: normalizedColor
  } as Record<string, unknown>
}

export const parseModuleInput = (value: unknown): ModuleInput => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  if (typeof record.type !== 'string' || !allowedTypes.includes(record.type as ModuleType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid module type' })
  }

  const type = record.type as ModuleType
  const isTextType = isTextModuleType(type)
  const defaultGridW = isTextType ? 12 : 6
  const defaultGridH = isTextType ? 1 : 5

  return {
    type,
    title: isTextType ? undefined : typeof record.title === 'string' ? record.title.trim() : undefined,
    config: parseModuleConfig(type, record.config),
    queryVisualizationId: isTextType
      ? undefined
      : (parseOptionalString(
          record.queryVisualizationId ?? record.query_visualization_id,
          'query visualization id'
        ) ?? undefined),
    gridX: parseNumber(record.gridX, 0),
    gridY: parseNumber(record.gridY, 0),
    gridW: parseNumber(record.gridW, defaultGridW),
    gridH: parseNumber(record.gridH, defaultGridH)
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

  if (record.queryVisualizationId !== undefined || record.query_visualization_id !== undefined) {
    updates.queryVisualizationId = parseOptionalString(
      record.queryVisualizationId ?? record.query_visualization_id,
      'query visualization id'
    )
  }

  if (record.gridX !== undefined) updates.gridX = parseNumber(record.gridX, 0)
  if (record.gridY !== undefined) updates.gridY = parseNumber(record.gridY, 0)
  if (record.gridW !== undefined) updates.gridW = parseNumber(record.gridW, 6)
  if (record.gridH !== undefined) updates.gridH = parseNumber(record.gridH, 5)

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
      gridH: parseNumber(record.gridH, 5)
    }
  })
}
