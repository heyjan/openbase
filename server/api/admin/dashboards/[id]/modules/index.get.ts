import { createError, defineEventHandler, getRouterParam } from 'h3'
import { listModules } from '~~/server/utils/dashboard-store'

export default defineEventHandler(async (event) => {
  const dashboardId = getRouterParam(event, 'id')
  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  return await listModules(dashboardId)
})
