import { defineEventHandler, readBody } from 'h3'
import { runDashboardAgent } from '~~/server/utils/ai-dashboard-agent'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return await runDashboardAgent(event, {
    message: typeof body?.message === 'string' ? body.message : ''
  })
})
