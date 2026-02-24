import { createError } from 'h3'
import { getDashboardBySlug } from './dashboard-store'
import { getShareLinkByToken } from './share-link-store'

export const requireSharedDashboardAccess = async (slug: string, token: string) => {
  const dashboard = await getDashboardBySlug(slug)
  const shareLink = await getShareLinkByToken(token)

  if (!shareLink || shareLink.dashboardId !== dashboard.id) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid share token' })
  }

  return { dashboard, shareLink }
}
