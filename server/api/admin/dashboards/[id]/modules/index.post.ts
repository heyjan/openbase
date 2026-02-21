import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { createModule } from '~~/server/utils/dashboard-store'
import { parseModuleInput } from '~~/server/utils/module-validators'

export default defineEventHandler(async (event) => {
  const dashboardId = getRouterParam(event, 'id')
  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  const payload = await readBody(event)
  const input = parseModuleInput(payload)
  return await createModule(dashboardId, input)
})
