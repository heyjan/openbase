import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { assignQueryToFolder } from '~~/server/utils/query-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing saved query id' })
  }
  const payload = await readBody(event)
  if (!payload || typeof payload !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }
  const folderId = payload.folderId === null || payload.folderId === undefined
    ? null
    : String(payload.folderId)
  await assignQueryToFolder(id, folderId)
  return { ok: true }
})
