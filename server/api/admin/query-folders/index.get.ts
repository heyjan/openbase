import { defineEventHandler } from 'h3'
import { listQueryFolders } from '~~/server/utils/query-folder-store'

export default defineEventHandler(async () => {
  return await listQueryFolders()
})
