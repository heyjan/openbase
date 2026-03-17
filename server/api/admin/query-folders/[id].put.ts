import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateQueryFolder } from '~~/server/utils/query-folder-store'
import { parseQueryFolderUpdate } from '~~/server/utils/query-folder-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing folder id' })
  }
  const payload = await readBody(event)
  const updates = parseQueryFolderUpdate(payload)
  return await updateQueryFolder(id, updates)
})
