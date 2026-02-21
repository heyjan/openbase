import { defineEventHandler } from 'h3'
import { listDashboards } from '~~/server/utils/dashboard-store'

export default defineEventHandler(async () => {
  return await listDashboards()
})
