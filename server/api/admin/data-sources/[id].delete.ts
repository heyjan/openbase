import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteDataSource } from '~~/server/utils/data-source-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  await deleteDataSource(id)
  return { ok: true }
})
