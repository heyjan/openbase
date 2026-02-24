import { defineEventHandler, getQuery } from 'h3'
import { listShareLinks } from '~~/server/utils/share-link-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dashboardId =
    typeof query.dashboardId === 'string' && query.dashboardId.trim()
      ? query.dashboardId.trim()
      : undefined

  return await listShareLinks({ dashboardId })
})
