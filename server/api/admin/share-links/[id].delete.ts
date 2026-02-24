import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteShareLink } from '~~/server/utils/share-link-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share link id' })
  }

  await deleteShareLink(id)
  return { ok: true }
})
