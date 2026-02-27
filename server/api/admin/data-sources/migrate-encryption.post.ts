import { defineEventHandler } from 'h3'
import { migrateDataSourceConnectionsToEncrypted } from '~~/server/utils/data-source-store'

export default defineEventHandler(async () => {
  return migrateDataSourceConnectionsToEncrypted()
})
