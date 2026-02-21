import { createError, defineEventHandler, getRouterParam } from 'h3'
import { triggerIngestionPipeline } from '~~/server/utils/ingestion-store'

type AdminContext = {
  email?: string
  name?: string
}

export default defineEventHandler(async (event) => {
  const pipeline = getRouterParam(event, 'pipeline')
  if (!pipeline) {
    throw createError({ statusCode: 400, statusMessage: 'Missing pipeline id' })
  }

  const admin = event.context.admin as AdminContext | undefined
  const triggeredBy = admin?.email || admin?.name

  return await triggerIngestionPipeline(pipeline, triggeredBy)
})
