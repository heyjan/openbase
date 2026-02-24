import { createError } from 'h3'
import type { DashboardInput, DashboardUpdate } from '~/types/dashboard'

const slugPattern = /^[a-z0-9-]+$/

const parseTags = (value: unknown) => {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tags' })
  }
  return value.map((tag) => tag.trim()).filter(Boolean)
}

const parseGridConfig = (value: unknown) => {
  if (value === undefined) {
    return undefined
  }

  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid grid config' })
  }

  const record = value as Record<string, unknown>
  const gridConfig: NonNullable<DashboardInput['gridConfig']> = {}

  if (record.canvasWidthMode !== undefined) {
    if (record.canvasWidthMode !== 'fixed' && record.canvasWidthMode !== 'full') {
      throw createError({
        statusCode: 400,
        statusMessage: 'canvasWidthMode must be fixed or full'
      })
    }
    gridConfig.canvasWidthMode = record.canvasWidthMode
  }

  return gridConfig
}

export const parseDashboardInput = (value: unknown): DashboardInput => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const slug = typeof record.slug === 'string' ? record.slug.trim() : ''
  const description =
    typeof record.description === 'string' && record.description.trim().length
      ? record.description.trim()
      : undefined

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!slug || !slugPattern.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug must be lowercase letters, numbers, or dashes'
    })
  }

  return {
    name,
    slug,
    description,
    tags: parseTags(record.tags),
    gridConfig: parseGridConfig(record.gridConfig)
  }
}

export const parseDashboardUpdate = (value: unknown): DashboardUpdate => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const updates: DashboardUpdate = {}

  if (record.name !== undefined) {
    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    }
    updates.name = record.name.trim()
  }

  if (record.slug !== undefined) {
    if (typeof record.slug !== 'string' || !slugPattern.test(record.slug.trim())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Slug must be lowercase letters, numbers, or dashes'
      })
    }
    updates.slug = record.slug.trim()
  }

  if (record.description !== undefined) {
    if (typeof record.description !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid description'
      })
    }
    updates.description = record.description.trim() || undefined
  }

  const tags = parseTags(record.tags)
  if (tags !== undefined) {
    updates.tags = tags
  }

  const gridConfig = parseGridConfig(record.gridConfig)
  if (gridConfig !== undefined) {
    updates.gridConfig = gridConfig
  }

  return updates
}
