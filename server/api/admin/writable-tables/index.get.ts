import { defineEventHandler } from 'h3'
import { listWritableTables } from '~~/server/utils/writable-table-store'

export default defineEventHandler(async () => {
  return listWritableTables()
})
