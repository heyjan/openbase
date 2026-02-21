import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateModule } from '~~/server/utils/dashboard-store'
import { parseModuleUpdate } from '~~/server/utils/module-validators'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }
  const payload = await readBody(event)
  const updates = parseModuleUpdate(payload)
  return await updateModule(moduleId, updates)
})
