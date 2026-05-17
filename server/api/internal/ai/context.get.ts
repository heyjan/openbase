import { defineEventHandler } from 'h3'
import { getAgentSchemaContext } from '~~/server/utils/ai-dashboard-agent'
import { requireInternalAiServiceToken } from '~~/server/utils/internal-ai-auth'

export default defineEventHandler(async (event) => {
  requireInternalAiServiceToken(event)

  return await getAgentSchemaContext()
})
