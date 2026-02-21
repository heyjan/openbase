import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateModuleLayout } from '~~/server/utils/dashboard-store'
import { parseLayoutUpdate } from '~~/server/utils/module-validators'

export default defineEventHandler(async (event) => {
  const dashboardId = getRouterParam(event, 'id')
  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  const payload = await readBody(event)
  const layout = parseLayoutUpdate(payload)
  return await updateModuleLayout(dashboardId, layout)
})
