import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteVisualizationFolder } from '~~/server/utils/visualization-folder-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing folder id' })
  }
  await deleteVisualizationFolder(id)
  return { ok: true }
})
