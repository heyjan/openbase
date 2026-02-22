import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { listModules } from '~~/server/utils/dashboard-store'
import { runSavedQueryById } from '~~/server/utils/query-runner'

const parseFilters = (query: Record<string, unknown>) => {
  const filters: Record<string, unknown> = {}
  const rawFilters = query.filters

  if (typeof rawFilters === 'string' && rawFilters.trim()) {
    try {
      const parsed = JSON.parse(rawFilters)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid')
      }
      Object.assign(filters, parsed as Record<string, unknown>)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'filters must be a valid JSON object'
      })
    }
  }

  for (const [key, value] of Object.entries(query)) {
    if (key === 'filters') {
      continue
    }
    if (Array.isArray(value)) {
      filters[key] = value[0]
      continue
    }
    filters[key] = value
  }

  return filters
}

const parseLimit = (moduleConfig: Record<string, unknown>) => {
  const limitCandidate = moduleConfig.limit ?? moduleConfig.row_limit
  if (typeof limitCandidate !== 'number' || Number.isNaN(limitCandidate)) {
    return 200
  }
  const rounded = Math.trunc(limitCandidate)
  if (rounded < 1) {
    return 200
  }
  return Math.min(rounded, 1000)
}

export default defineEventHandler(async (event) => {
  const dashboardId = getRouterParam(event, 'id')
  const moduleId = getRouterParam(event, 'moduleId')
  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }

  const modules = await listModules(dashboardId)
  const module = modules.find((item) => item.id === moduleId)
  if (!module) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }

  const moduleConfig = module.config || {}
  const savedQueryId = module.queryVisualizationQueryId ?? ''

  if (!savedQueryId.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Module is missing a linked query visualization'
    })
  }

  const filters = parseFilters(getQuery(event) as Record<string, unknown>)
  return await runSavedQueryById({
    savedQueryId,
    parameters: filters,
    limit: parseLimit(moduleConfig)
  })
})
