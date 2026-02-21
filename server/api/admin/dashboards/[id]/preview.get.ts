import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDashboardById, listModules } from '~~/server/utils/dashboard-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  const dashboard = await getDashboardById(id)
  return { dashboard, modules: await listModules(id) }
})
