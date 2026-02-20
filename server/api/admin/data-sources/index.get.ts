import { defineEventHandler } from 'h3'
import { listDataSources } from '~~/server/utils/data-source-store'

export default defineEventHandler(async () => {
  return listDataSources()
})
