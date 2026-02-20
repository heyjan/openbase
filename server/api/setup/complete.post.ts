import {
  createError,
  defineEventHandler,
  readBody,
  setCookie
} from 'h3'
import bcrypt from 'bcryptjs'
import {
  createAdminUser,
  createSession,
  consumeMagicLink,
  getAdminCount,
  updateLastLogin
} from '~~/server/utils/admin-store'
import { ADMIN_SESSION_COOKIE, SESSION_TTL_DAYS } from '~~/server/utils/auth'
import { validatePassword } from '~~/server/utils/password'

type Body = {
  token?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const count = await getAdminCount()
  if (count > 0) {
    throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })
  }

  const body = (await readBody(event)) as Body
  const token = body?.token?.trim()
  const password = body?.password || ''

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  const validation = validatePassword(password)
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password does not meet strength requirements'
    })
  }

  const email = await consumeMagicLink(token)
  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await createAdminUser(email, passwordHash, email)
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

  return { admin }
})
