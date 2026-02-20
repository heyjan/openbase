import { createError, defineEventHandler, getRouterParam } from 'h3'
import { rotateDashboardToken } from '~~/server/utils/dashboard-store'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  return rotateDashboardToken(id)
})
