import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteModule } from '~~/server/utils/dashboard-store'

export default defineEventHandler((event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }
  deleteModule(moduleId)
  return { ok: true }
})
