import { defineEventHandler, getQuery } from 'h3'
import { listQueryVisualizations } from '~~/server/utils/query-visualization-store'
import { parseQueryVisualizationListInput } from '~~/server/utils/query-visualization-validators'

export default defineEventHandler(async (event) => {
  const filters = parseQueryVisualizationListInput(getQuery(event))
  return await listQueryVisualizations(filters)
})
