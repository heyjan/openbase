import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { assignVisualizationToFolder } from '~~/server/utils/query-visualization-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing query visualization id' })
  }
  const payload = await readBody(event)
  if (!payload || typeof payload !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }
  const folderId = payload.folderId === null || payload.folderId === undefined
    ? null
    : String(payload.folderId)
  await assignVisualizationToFolder(id, folderId)
  return { ok: true }
})
