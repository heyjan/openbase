import { createError, defineEventHandler, readBody } from 'h3'
import { createShareLink } from '~~/server/utils/share-link-store'

type Payload = {
  dashboardId?: string
  label?: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Payload
  const dashboardId =
    typeof body?.dashboardId === 'string' ? body.dashboardId.trim() : ''

  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'dashboardId is required' })
  }

  const label =
    typeof body?.label === 'string' && body.label.trim().length
      ? body.label.trim()
      : undefined

  return await createShareLink(dashboardId, label)
})
