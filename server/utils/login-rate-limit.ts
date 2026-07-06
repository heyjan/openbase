import { createHash } from 'node:crypto'
import { createError, setHeader, type H3Event } from 'h3'
import {
  consumeRateLimit,
  getRateLimitStatus,
  resetRateLimit
} from './rate-limiter'

const ACCOUNT_FAILURE_LIMIT = 5
const ACCOUNT_FAILURE_WINDOW_MS = 15 * 60_000

type LoginScope = 'admin' | 'editor'

const buildAccountLoginKey = (scope: LoginScope, email: string) => {
  const digest = createHash('sha256').update(email).digest('hex')
  return `login-account:${scope}:${digest}`
}

export const assertLoginAccountAllowed = (
  event: H3Event,
  scope: LoginScope,
  email: string
) => {
  const key = buildAccountLoginKey(scope, email)
  const result = getRateLimitStatus(
    key,
    ACCOUNT_FAILURE_LIMIT,
    ACCOUNT_FAILURE_WINDOW_MS
  )

  if (result.allowed) {
    return
  }

  setHeader(event, 'Retry-After', String(Math.ceil(result.resetMs / 1000)))
  throw createError({
    statusCode: 429,
    statusMessage: 'Too many failed login attempts'
  })
}

export const recordFailedLogin = (
  event: H3Event,
  scope: LoginScope,
  email: string
) => {
  const key = buildAccountLoginKey(scope, email)
  const result = consumeRateLimit(
    key,
    ACCOUNT_FAILURE_LIMIT,
    ACCOUNT_FAILURE_WINDOW_MS
  )

  if (result.allowed) {
    return
  }

  setHeader(event, 'Retry-After', String(Math.ceil(result.resetMs / 1000)))
  throw createError({
    statusCode: 429,
    statusMessage: 'Too many failed login attempts'
  })
}

export const resetLoginAccountLimit = (scope: LoginScope, email: string) => {
  resetRateLimit(buildAccountLoginKey(scope, email))
}
