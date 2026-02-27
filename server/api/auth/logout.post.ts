import { defineEventHandler, getCookie, deleteCookie } from 'h3'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { deleteSession, getAdminBySessionToken } from '~~/server/utils/admin-store'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, ADMIN_SESSION_COOKIE)
  const admin = token ? await getAdminBySessionToken(token) : null
  if (token) {
    await deleteSession(token)
  }
  deleteCookie(event, ADMIN_SESSION_COOKIE, { path: '/' })

  try {
    await createAuditEntry({
      actorId: admin?.id,
      actorType: 'admin',
      action: 'auth.logout',
      resource: 'admin_session',
      details: admin ? { email: admin.email } : {}
    })
  } catch {
    // Audit logging failures should not block logout.
  }

  return { ok: true }
})
