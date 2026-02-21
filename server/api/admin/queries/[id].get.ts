import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getSavedQueryById } from '~~/server/utils/query-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing saved query id' })
  }
  return await getSavedQueryById(id)
})
