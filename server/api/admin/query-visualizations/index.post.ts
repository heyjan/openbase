import { defineEventHandler, readBody } from 'h3'
import { createQueryVisualization } from '~~/server/utils/query-visualization-store'
import { parseQueryVisualizationInput } from '~~/server/utils/query-visualization-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseQueryVisualizationInput(payload)
  return await createQueryVisualization(input)
})
