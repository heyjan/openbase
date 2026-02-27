import {
  createError,
  defineEventHandler,
  getRequestIP,
  readBody,
  setCookie
} from 'h3'
import bcrypt from 'bcryptjs'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { EDITOR_SESSION_COOKIE, SESSION_TTL_DAYS } from '~~/server/utils/auth'
import {
  createEditorSession,
  getEditorByEmail,
  updateEditorLastLogin
} from '~~/server/utils/editor-store'

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

  const editor = await getEditorByEmail(email)
  if (!editor || !editor.is_active) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const matches = await bcrypt.compare(password, editor.password_hash)
  if (!matches) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await updateEditorLastLogin(editor.id)

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const sessionToken = await createEditorSession(editor.id, expiresAt)

  setCookie(event, EDITOR_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  })

  try {
    await createAuditEntry({
      actorId: editor.id,
      actorType: 'editor',
      action: 'auth.login',
      resource: 'editor_session',
      details: { email: editor.email },
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? null
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
