import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRequestIP,
  getRouterParam
} from 'h3'
import { getDashboardBySlug, listModules } from '~~/server/utils/dashboard-store'
import { query as dbQuery } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }

  const { token } = getQuery(event)
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const dashboard = await getDashboardBySlug(slug)
  if (dashboard.shareToken !== token) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid share token' })
  }

  const ipAddress = getRequestIP(event, { xForwardedFor: true }) ?? null
  const userAgent = getHeader(event, 'user-agent') ?? null
  try {
    await dbQuery(
      `INSERT INTO access_log (dashboard_id, share_token, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [dashboard.id, token, ipAddress, userAgent]
    )
  } catch {
    // Access logging failures must not block dashboard reads.
  }

  return { dashboard, modules: await listModules(dashboard.id) }
})
