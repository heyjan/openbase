import {
  createError,
  defineEventHandler,
  readBody,
  setCookie
} from 'h3'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { EDITOR_SESSION_COOKIE, SESSION_TTL_DAYS } from '~~/server/utils/auth'
import {
  createEditorSession,
  getEditorByEmail,
  updateEditorLastLogin
} from '~~/server/utils/editor-store'
import {
  assertLoginAccountAllowed,
  recordFailedLogin,
  resetLoginAccountLimit
} from '~~/server/utils/login-rate-limit'
import { verifyPassword } from '~~/server/utils/password'
import { getClientIp } from '~~/server/utils/request-ip'

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

  assertLoginAccountAllowed(event, 'editor', email)
  const editor = await getEditorByEmail(email)

  // Verify against a constant-time helper that always runs bcrypt (even for a
  // missing account) so response timing does not reveal account existence.
  const matches = await verifyPassword(password, editor?.password_hash)

  if (!editor || !editor.is_active || !matches) {
    recordFailedLogin(event, 'editor', email)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  resetLoginAccountLimit('editor', email)
  await updateEditorLastLogin(editor.id)

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const sessionToken = await createEditorSession(editor.id, expiresAt)
  const maxAgeSeconds = SESSION_TTL_DAYS * 24 * 60 * 60

  setCookie(event, EDITOR_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
    maxAge: maxAgeSeconds
  })

  try {
    await createAuditEntry({
      actorId: editor.id,
      actorType: 'editor',
      action: 'auth.login',
      resource: 'editor_session',
      details: { email: editor.email },
      ipAddress: getClientIp(event)
    })
  } catch {
    // Audit logging failures should not block auth.
  }

  return {
    editor: {
      id: editor.id,
      email: editor.email,
      name: editor.name,
      is_active: editor.is_active,
      created_at: editor.created_at,
      last_login_at: editor.last_login_at
    }
  }
})
