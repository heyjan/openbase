import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateDashboard } from '~~/server/utils/dashboard-store'
import { parseDashboardUpdate } from '~~/server/utils/dashboard-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }

  const payload = await readBody(event)
  const updates = parseDashboardUpdate(payload)
  return await updateDashboard(id, updates)
})
