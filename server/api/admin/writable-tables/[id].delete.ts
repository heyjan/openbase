import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteWritableTable } from '~~/server/utils/writable-table-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing writable table id' })
  }

  await deleteWritableTable(id)
  return { ok: true }
})
