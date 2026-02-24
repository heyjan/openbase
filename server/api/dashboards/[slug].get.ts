import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRequestIP,
  getRouterParam
} from 'h3'
import { listModules } from '~~/server/utils/dashboard-store'
import { query as dbQuery } from '~~/server/utils/db'
import { requireSharedDashboardAccess } from '~~/server/utils/share-access'
import { incrementViewCount } from '~~/server/utils/share-link-store'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }

  const { token } = getQuery(event)
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const { dashboard, shareLink } = await requireSharedDashboardAccess(slug, token)

  const ipAddress = getRequestIP(event, { xForwardedFor: true }) ?? null
  const userAgent = getHeader(event, 'user-agent') ?? null
  try {
    await incrementViewCount(shareLink.id)
    await dbQuery(
      `INSERT INTO access_log (dashboard_id, share_link_id, share_token, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [dashboard.id, shareLink.id, token, ipAddress, userAgent]
    )
  } catch {
    // Access logging failures must not block dashboard reads.
  }

  return { dashboard, modules: await listModules(dashboard.id) }
})
