import { createError, getCookie, type H3Event } from 'h3'
import { SHARE_LINK_SESSION_COOKIE } from './auth'
import { getDashboardBySlug } from './dashboard-store'
import { verifyShareLinkSessionValue } from './share-link-session'
import { getShareLinkByToken } from './share-link-store'

export const requireSharedDashboardAccess = async (
  event: H3Event,
  slug: string,
  token: string
) => {
  const dashboard = await getDashboardBySlug(slug)
  const shareLink = await getShareLinkByToken(token)

  if (!shareLink || shareLink.dashboardId !== dashboard.id) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid share token' })
  }

  if (shareLink.passwordHash) {
    const sessionValue = getCookie(event, SHARE_LINK_SESSION_COOKIE) ?? ''
    const isAuthorized = sessionValue
      ? verifyShareLinkSessionValue(sessionValue, token, shareLink.passwordHash)
      : false

    if (!isAuthorized) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Password required',
        data: { requiresPassword: true }
      })
    }
  }

  return { dashboard, shareLink }
}
