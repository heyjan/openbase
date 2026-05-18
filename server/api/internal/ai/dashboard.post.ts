import { defineEventHandler, readBody } from 'h3'
import { runDashboardAgent } from '~~/server/utils/ai-dashboard-agent'
import { requireInternalAiServiceToken } from '~~/server/utils/internal-ai-auth'

export default defineEventHandler(async (event) => {
  requireInternalAiServiceToken(event)

  const body = await readBody(event)
  return await runDashboardAgent(event, {
    message: typeof body?.message === 'string' ? body.message : '',
    publicOrigin: typeof body?.publicOrigin === 'string' ? body.publicOrigin : undefined
  })
})
