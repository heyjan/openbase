import { createError, defineEventHandler, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import { createShareLink } from '~~/server/utils/share-link-store'

type Payload = {
  dashboardId?: string
  label?: string
  password?: string | null
}

const SHARE_LINK_PASSWORD_ROUNDS = 12

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

  const rawPassword =
    typeof body?.password === 'string' ? body.password.trim() : ''
  const passwordHash = rawPassword
    ? await bcrypt.hash(rawPassword, SHARE_LINK_PASSWORD_ROUNDS)
    : null

  return await createShareLink(dashboardId, label, passwordHash)
})
