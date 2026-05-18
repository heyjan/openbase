import { defineEventHandler } from 'h3'
import { AGENT_CHART_CATALOG } from '~~/shared/ai/chart-catalog'
import { listDataSources } from '~~/server/utils/data-source-store'
import { toPublicDataSources } from '~~/server/utils/data-source-public'

export default defineEventHandler(async () => ({
  charts: AGENT_CHART_CATALOG,
  dataSources: toPublicDataSources(await listDataSources())
}))
