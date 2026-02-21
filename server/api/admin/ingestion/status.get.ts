import { defineEventHandler } from 'h3'
import { getIngestionStatus } from '~~/server/utils/ingestion-store'

export default defineEventHandler(async () => {
  return await getIngestionStatus()
})
