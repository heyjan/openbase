import { defineEventHandler, readBody } from 'h3'
import { createVisualizationFolder } from '~~/server/utils/visualization-folder-store'
import { parseVisualizationFolderInput } from '~~/server/utils/visualization-folder-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseVisualizationFolderInput(payload)
  return await createVisualizationFolder(input)
})
