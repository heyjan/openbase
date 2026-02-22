import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteQueryVisualization } from '~~/server/utils/query-visualization-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing query visualization id' })
  }

  await deleteQueryVisualization(id)
  return { ok: true }
})
