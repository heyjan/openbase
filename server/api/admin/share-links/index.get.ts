import { defineEventHandler } from 'h3'
import { query } from '~~/server/utils/db'

type ShareLinkRow = {
  dashboard_id: string
  dashboard_name: string
  slug: string
  share_token: string
  updated_at: string
  last_accessed_at: string | null
  view_count: string
}

export default defineEventHandler(async () => {
  const result = await query<ShareLinkRow>(
    `SELECT
       d.id AS dashboard_id,
       d.name AS dashboard_name,
       d.slug,
       d.share_token,
       d.updated_at,
       MAX(a.accessed_at) AS last_accessed_at,
       COUNT(a.id)::text AS view_count
     FROM dashboards d
     LEFT JOIN access_log a
       ON a.dashboard_id = d.id
      AND a.share_token = d.share_token
     WHERE d.is_active = true
     GROUP BY d.id, d.name, d.slug, d.share_token, d.updated_at
     ORDER BY d.updated_at DESC`
  )

  return result.rows.map((row) => ({
    dashboardId: row.dashboard_id,
    dashboardName: row.dashboard_name,
    slug: row.slug,
    shareToken: row.share_token,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    viewCount: Number(row.view_count)
  }))
})
