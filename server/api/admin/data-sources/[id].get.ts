import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDataSourceById } from '~~/server/utils/data-source-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing data source id' })
  }
  return getDataSourceById(id)
})
