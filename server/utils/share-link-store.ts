import { randomUUID } from 'crypto'
import { createError } from 'h3'
import { query } from './db'

export type ShareLinkRecord = {
  id: string
  dashboardId: string
  token: string
  label: string | null
  isActive: boolean
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ShareLinkRecordWithStats = ShareLinkRecord & {
  dashboardName: string
  dashboardSlug: string
}

type ShareLinkRow = {
  id: string
  dashboard_id: string
  token: string
  label: string | null
  is_active: boolean
  view_count: number
  last_viewed_at: string | null
  created_at: string
  updated_at: string
}

type ShareLinkListRow = ShareLinkRow & {
  dashboard_name: string
  dashboard_slug: string
}

const generateToken = () => randomUUID().replace(/-/g, '')
let ensureShareLinkSchemaPromise: Promise<void> | null = null

const ensureShareLinkSchema = async () => {
  if (!ensureShareLinkSchemaPromise) {
    ensureShareLinkSchemaPromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS share_links (
           id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           dashboard_id   UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
           token          VARCHAR(64) UNIQUE NOT NULL,
           label          VARCHAR(255),
           is_active      BOOLEAN NOT NULL DEFAULT true,
           view_count     INTEGER NOT NULL DEFAULT 0,
           last_viewed_at TIMESTAMPTZ,
           created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
           updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )

      await query(
        'CREATE INDEX IF NOT EXISTS idx_share_links_dashboard_id ON share_links(dashboard_id)'
      )
      await query(
        'CREATE INDEX IF NOT EXISTS idx_share_links_active_dashboard ON share_links(is_active, dashboard_id)'
      )

      await query(
        `ALTER TABLE dashboards
         ALTER COLUMN share_token DROP NOT NULL`
      )

      await query(
        `DO $$
         BEGIN
           IF NOT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'access_log'
               AND column_name = 'share_link_id'
           ) THEN
             ALTER TABLE access_log
             ADD COLUMN share_link_id UUID REFERENCES share_links(id) ON DELETE SET NULL;
           END IF;
         END $$`
      )

      await query(
        `INSERT INTO share_links (dashboard_id, token, is_active, created_at, updated_at)
         SELECT d.id, d.share_token, true, d.created_at, d.updated_at
         FROM dashboards d
         WHERE d.share_token IS NOT NULL
         ON CONFLICT (token) DO NOTHING`
      )

      await query(
        `UPDATE access_log a
         SET share_link_id = sl.id
         FROM share_links sl
         WHERE a.share_link_id IS NULL
           AND a.dashboard_id = sl.dashboard_id
           AND a.share_token = sl.token`
      )

      await query(
        `WITH share_stats AS (
           SELECT
             sl.id AS share_link_id,
             COUNT(a.id)::INTEGER AS view_count,
             MAX(a.accessed_at) AS last_viewed_at
           FROM share_links sl
           LEFT JOIN access_log a
             ON a.dashboard_id = sl.dashboard_id
            AND (
              a.share_link_id = sl.id
              OR (a.share_link_id IS NULL AND a.share_token = sl.token)
            )
           GROUP BY sl.id
         )
         UPDATE share_links sl
         SET
           view_count = share_stats.view_count,
           last_viewed_at = share_stats.last_viewed_at
         FROM share_stats
         WHERE sl.id = share_stats.share_link_id`
      )
    })()
  }

  await ensureShareLinkSchemaPromise
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

const mapShareLink = (row: ShareLinkRow): ShareLinkRecord => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  token: row.token,
  label: row.label,
  isActive: row.is_active,
  viewCount: row.view_count,
  lastViewedAt: row.last_viewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapShareLinkWithStats = (row: ShareLinkListRow): ShareLinkRecordWithStats => ({
  ...mapShareLink(row),
  dashboardName: row.dashboard_name,
  dashboardSlug: row.dashboard_slug
})

const ensureDashboardExists = async (dashboardId: string) => {
  await ensureShareLinkSchema()

  const result = await query<{ id: string }>(
    `SELECT id
     FROM dashboards
     WHERE id = $1
       AND is_active = true`,
    [dashboardId]
  )

  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
}

export const createShareLink = async (
  dashboardId: string,
  label?: string
): Promise<ShareLinkRecord> => {
  await ensureDashboardExists(dashboardId)

  const normalizedLabel = label?.trim() ? label.trim() : null
  let attempts = 0

  while (attempts < 3) {
    attempts += 1
    try {
      const result = await query<ShareLinkRow>(
        `INSERT INTO share_links (dashboard_id, token, label)
         VALUES ($1, $2, $3)
         RETURNING id, dashboard_id, token, label, is_active, view_count, last_viewed_at, created_at, updated_at`,
        [dashboardId, generateToken(), normalizedLabel]
      )

      return mapShareLink(result.rows[0])
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue
      }
      throw error
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Unable to generate unique share token'
  })
}

export const listShareLinks = async (filters?: {
  dashboardId?: string
}): Promise<ShareLinkRecordWithStats[]> => {
  await ensureShareLinkSchema()

  const values: string[] = []
  const conditions = ['sl.is_active = true', 'd.is_active = true']

  if (filters?.dashboardId) {
    values.push(filters.dashboardId)
    conditions.push(`sl.dashboard_id = $${values.length}`)
  }

  const result = await query<ShareLinkListRow>(
    `SELECT
       sl.id,
       sl.dashboard_id,
       sl.token,
       sl.label,
       sl.is_active,
       sl.view_count,
       sl.last_viewed_at,
       sl.created_at,
       sl.updated_at,
       d.name AS dashboard_name,
       d.slug AS dashboard_slug
     FROM share_links sl
     INNER JOIN dashboards d ON d.id = sl.dashboard_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sl.created_at DESC`,
    values
  )

  return result.rows.map(mapShareLinkWithStats)
}

export const getShareLinkByToken = async (
  token: string
): Promise<ShareLinkRecord | null> => {
  await ensureShareLinkSchema()

  const result = await query<ShareLinkRow>(
    `SELECT id, dashboard_id, token, label, is_active, view_count, last_viewed_at, created_at, updated_at
     FROM share_links
     WHERE token = $1
       AND is_active = true`,
    [token]
  )

  const row = result.rows[0]
  return row ? mapShareLink(row) : null
}

export const deleteShareLink = async (id: string): Promise<void> => {
  await ensureShareLinkSchema()

  const result = await query(
    `UPDATE share_links
     SET is_active = false, updated_at = now()
     WHERE id = $1
       AND is_active = true
     RETURNING id`,
    [id]
  )

  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Share link not found' })
  }
}

export const incrementViewCount = async (id: string): Promise<void> => {
  await ensureShareLinkSchema()

  await query(
    `UPDATE share_links
     SET
       view_count = view_count + 1,
       last_viewed_at = now(),
       updated_at = now()
     WHERE id = $1
       AND is_active = true`,
    [id]
  )
}
