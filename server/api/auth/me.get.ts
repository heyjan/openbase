import { createError, defineEventHandler, getCookie } from 'h3'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { getAdminBySessionToken } from '~~/server/utils/admin-store'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const admin = await getAdminBySessionToken(token)
  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { admin }
})
