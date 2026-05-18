import { defineEventHandler } from 'h3'
import { AGENT_CHART_CATALOG } from '~~/shared/ai/chart-catalog'
import { listDataSources } from '~~/server/utils/data-source-store'
import { toPublicDataSources } from '~~/server/utils/data-source-public'
import { requireInternalAiServiceToken } from '~~/server/utils/internal-ai-auth'

export default defineEventHandler(async (event) => {
  requireInternalAiServiceToken(event)

  return {
    charts: AGENT_CHART_CATALOG,
    dataSources: toPublicDataSources(await listDataSources())
  }
})
