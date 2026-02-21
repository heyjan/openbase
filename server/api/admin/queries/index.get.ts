import { defineEventHandler } from 'h3'
import { listSavedQueries } from '~~/server/utils/query-store'

export default defineEventHandler(async () => {
  return await listSavedQueries()
})
