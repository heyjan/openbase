import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { getDashboardBySlug, listModules } from '~~/server/utils/dashboard-store'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }

  const { token } = getQuery(event)
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const dashboard = getDashboardBySlug(slug)
  if (dashboard.shareToken !== token) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid share token' })
  }

  return { dashboard, modules: listModules(dashboard.id) }
})
