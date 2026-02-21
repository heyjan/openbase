import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateSavedQuery } from '~~/server/utils/query-store'
import { parseSavedQueryUpdate } from '~~/server/utils/query-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing saved query id' })
  }
  const payload = await readBody(event)
  const updates = parseSavedQueryUpdate(payload)
  return await updateSavedQuery(id, updates)
})
