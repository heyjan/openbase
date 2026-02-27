import {
  createError,
  defineEventHandler,
  getRequestIP,
  readBody,
  setCookie
} from 'h3'
import bcrypt from 'bcryptjs'
import { createAuditEntry } from '~~/server/utils/audit-store'
import {
  createSession,
  getAdminByEmail,
  updateLastLogin
} from '~~/server/utils/admin-store'
import { ADMIN_SESSION_COOKIE, SESSION_TTL_DAYS } from '~~/server/utils/auth'

type Body = {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password || ''

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password required' })
  }

  const admin = await getAdminByEmail(email)
  if (!admin || !admin.is_active) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const matches = await bcrypt.compare(password, admin.password_hash)
  if (!matches) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await updateLastLogin(admin.id)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const sessionToken = await createSession(admin.id, expiresAt)

  setCookie(event, ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  })

  try {
    await createAuditEntry({
      actorId: admin.id,
      actorType: 'admin',
      action: 'auth.login',
      resource: 'admin_session',
      details: { email: admin.email },
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? null
    })
  } catch {
    // Audit logging failures should not block auth.
  }

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      is_active: admin.is_active,
      created_at: admin.created_at,
      last_login_at: admin.last_login_at
    }
  }
})
