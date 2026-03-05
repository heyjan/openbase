import { defineEventHandler } from 'h3'
import { listDataSources } from '~~/server/utils/data-source-store'
import { toPublicDataSources } from '~~/server/utils/data-source-public'

export default defineEventHandler(async () => {
  return toPublicDataSources(await listDataSources())
})
