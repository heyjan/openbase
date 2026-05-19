import {
  createError,
  defineEventHandler,
  getRequestIP,
  readBody,
  setCookie,
  setHeader
} from 'h3'
import bcrypt from 'bcryptjs'
import { SHARE_LINK_SESSION_COOKIE } from '~~/server/utils/auth'
import { consumeRateLimit } from '~~/server/utils/rate-limiter'
import {
  createShareLinkSessionValue
} from '~~/server/utils/share-link-session'
import { getShareLinkByToken } from '~~/server/utils/share-link-store'

const PASSWORD_VERIFY_LIMIT = 5
const PASSWORD_VERIFY_WINDOW_MS = 60_000

type Body = {
  token?: string
  password?: string
}

const getErrorMessage = () => 'Invalid token or password'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'token and password are required'
    })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rateLimit = consumeRateLimit(
    `shared-password:${token}:${ip}`,
    PASSWORD_VERIFY_LIMIT,
    PASSWORD_VERIFY_WINDOW_MS
  )

  setHeader(event, 'X-RateLimit-Limit', String(PASSWORD_VERIFY_LIMIT))
  setHeader(event, 'X-RateLimit-Remaining', String(rateLimit.remaining))

  if (!rateLimit.allowed) {
    setHeader(event, 'Retry-After', String(Math.ceil(rateLimit.resetMs / 1000)))
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded'
    })
  }

  const shareLink = await getShareLinkByToken(token)
  if (!shareLink?.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: getErrorMessage()
    })
  }

  const matches = await bcrypt.compare(password, shareLink.passwordHash)
  if (!matches) {
    throw createError({
      statusCode: 401,
      statusMessage: getErrorMessage()
    })
  }

  const session = createShareLinkSessionValue(token, shareLink.passwordHash)
  setCookie(event, SHARE_LINK_SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt,
    maxAge: session.maxAgeSeconds
  })

  return { ok: true }
})
