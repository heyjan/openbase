import { defineEventHandler, readBody } from 'h3'
import { runDashboardAgent } from '~~/server/utils/ai-dashboard-agent'
import { requireInternalAiServiceToken } from '~~/server/utils/internal-ai-auth'

export default defineEventHandler(async (event) => {
  requireInternalAiServiceToken(event)

  const body = await readBody(event)
  return await runDashboardAgent(event, {
    message: typeof body?.message === 'string' ? body.message : '',
    publicOrigin: typeof body?.publicOrigin === 'string' ? body.publicOrigin : undefined,
    dataSourceId: typeof body?.dataSourceId === 'string' ? body.dataSourceId : undefined,
    title: typeof body?.title === 'string' ? body.title : undefined,
    sql: typeof body?.sql === 'string' ? body.sql : undefined,
    moduleType: typeof body?.moduleType === 'string' ? body.moduleType : undefined,
    visualizationConfig: body?.visualizationConfig &&
      typeof body.visualizationConfig === 'object' &&
      !Array.isArray(body.visualizationConfig)
      ? body.visualizationConfig
      : undefined
  })
})
