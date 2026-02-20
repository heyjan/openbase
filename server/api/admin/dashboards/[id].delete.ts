import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteDashboard } from '~~/server/utils/dashboard-store'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  deleteDashboard(id)
  return { ok: true }
})
