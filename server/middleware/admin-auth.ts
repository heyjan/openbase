import { createError, defineEventHandler, getCookie } from 'h3'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { getAdminBySessionToken } from '~~/server/utils/admin-store'

export default defineEventHandler(async (event) => {
  if (!event.path?.startsWith('/api/admin')) {
    return
  }

  const sessionToken = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const admin = await getAdminBySessionToken(sessionToken)
  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  event.context.admin = admin
})
