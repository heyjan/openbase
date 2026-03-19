import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateVisualizationFolder } from '~~/server/utils/visualization-folder-store'
import { parseVisualizationFolderUpdate } from '~~/server/utils/visualization-folder-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing folder id' })
  }
  const payload = await readBody(event)
  const updates = parseVisualizationFolderUpdate(payload)
  return await updateVisualizationFolder(id, updates)
})
