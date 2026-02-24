import {
  createError,
  defineEventHandler,
  getQuery,
  getRouterParam,
  readBody
} from 'h3'
import { query } from '~~/server/utils/db'
import { requireSharedDashboardAccess } from '~~/server/utils/share-access'

type AnnotationRow = {
  id: string
  dashboard_id: string
  asin: string | null
  product_group: string | null
  event_date: string | null
  author_name: string
  note: string
  tags: string[] | null
  created_at: string
}

type Body = {
  asin?: string
  product_group?: string
  productGroup?: string
  event_date?: string
  eventDate?: string
  author_name?: string
  authorName?: string
  note?: string
  tags?: string[] | string
}

const parseTags = (value: unknown) => {
  if (value === undefined || value === null) {
    return [] as string[]
  }
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid tags' })
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }

  const { token } = getQuery(event)
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const { dashboard } = await requireSharedDashboardAccess(slug, token)

  const body = (await readBody(event)) as Body
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const authorName =
    typeof body.author_name === 'string'
      ? body.author_name.trim()
      : typeof body.authorName === 'string'
        ? body.authorName.trim()
        : ''

  if (!authorName) {
    throw createError({ statusCode: 400, statusMessage: 'Author name is required' })
  }
  if (!note) {
    throw createError({ statusCode: 400, statusMessage: 'Note is required' })
  }

  const asin = typeof body.asin === 'string' ? body.asin.trim() : ''
  const productGroup =
    typeof body.product_group === 'string'
      ? body.product_group.trim()
      : typeof body.productGroup === 'string'
        ? body.productGroup.trim()
        : ''
  const eventDate =
    typeof body.event_date === 'string'
      ? body.event_date.trim()
      : typeof body.eventDate === 'string'
        ? body.eventDate.trim()
        : ''
  const tags = parseTags(body.tags)

  const inserted = await query<AnnotationRow>(
    `INSERT INTO annotations (
       dashboard_id,
       asin,
       product_group,
       event_date,
       author_name,
       note,
       tags
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, dashboard_id, asin, product_group, event_date, author_name, note, tags, created_at`,
    [
      dashboard.id,
      asin || null,
      productGroup || null,
      eventDate || null,
      authorName,
      note,
      tags
    ]
  )

  const annotation = inserted.rows[0]
  return {
    id: annotation.id,
    dashboardId: annotation.dashboard_id,
    asin: annotation.asin,
    productGroup: annotation.product_group,
    eventDate: annotation.event_date,
    authorName: annotation.author_name,
    note: annotation.note,
    tags: annotation.tags ?? [],
    createdAt: annotation.created_at
  }
})
