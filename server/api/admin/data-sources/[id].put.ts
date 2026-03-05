import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateDataSource } from '~~/server/utils/data-source-store'
import { parseDataSourceUpdate } from '~~/server/utils/data-source-validators'
import { toPublicDataSource } from '~~/server/utils/data-source-public'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  const payload = await readBody(event)
  const updates = parseDataSourceUpdate(payload)
  return toPublicDataSource(await updateDataSource(id, updates))
})
