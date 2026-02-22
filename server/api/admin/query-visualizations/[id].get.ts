import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getQueryVisualizationById } from '~~/server/utils/query-visualization-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing query visualization id' })
  }

  return await getQueryVisualizationById(id)
})
