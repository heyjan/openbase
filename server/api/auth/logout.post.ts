import { defineEventHandler, getCookie, deleteCookie } from 'h3'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { deleteSession } from '~~/server/utils/admin-store'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, ADMIN_SESSION_COOKIE)
  if (token) {
    await deleteSession(token)
  }
  deleteCookie(event, ADMIN_SESSION_COOKIE, { path: '/' })
  return { ok: true }
})
