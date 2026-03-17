import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteQueryFolder } from '~~/server/utils/query-folder-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing folder id' })
  }
  await deleteQueryFolder(id)
  return { ok: true }
})
