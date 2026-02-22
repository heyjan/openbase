import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateQueryVisualization } from '~~/server/utils/query-visualization-store'
import { parseQueryVisualizationUpdate } from '~~/server/utils/query-visualization-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing query visualization id' })
  }

  const payload = await readBody(event)
  const updates = parseQueryVisualizationUpdate(payload)
  return await updateQueryVisualization(id, updates)
})
