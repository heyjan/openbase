import { defineEventHandler, readBody } from 'h3'
import { createDashboard } from '~~/server/utils/dashboard-store'
import { parseDashboardInput } from '~~/server/utils/dashboard-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseDashboardInput(payload)
  return createDashboard(input)
})
