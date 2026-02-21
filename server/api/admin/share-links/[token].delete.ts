import { randomUUID } from 'crypto'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { query } from '~~/server/utils/db'

const generateToken = () => randomUUID().replace(/-/g, '')

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share token' })
  }

  const updated = await query(
    `UPDATE dashboards
     SET share_token = $1, updated_at = now()
     WHERE share_token = $2
     RETURNING id`,
    [generateToken(), token]
  )
  if (updated.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Share link not found' })
  }

  return { ok: true }
})
