import { defineEventHandler, getCookie, sendRedirect } from 'h3'
import { getAdminBySessionToken, getAdminCount } from '~~/server/utils/admin-store'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''
  const pathname = path.split('?')[0] ?? path

  if (!pathname.startsWith('/admin')) {
    return
  }

  const adminCount = await getAdminCount()
  if (adminCount === 0) {
    return sendRedirect(event, '/setup', 302)
  }

  if (pathname === '/admin/login') {
    return
  }

  const sessionToken = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!sessionToken) {
    return sendRedirect(event, '/admin/login', 302)
  }

  const admin = await getAdminBySessionToken(sessionToken)
  if (!admin) {
    return sendRedirect(event, '/admin/login', 302)
  }
})
