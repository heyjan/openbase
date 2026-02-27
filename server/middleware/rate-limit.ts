import {
  createError,
  defineEventHandler,
  getCookie,
  getMethod,
  getRequestIP,
  setHeader,
  type H3Event
} from 'h3'
import {
  ADMIN_SESSION_COOKIE,
  EDITOR_SESSION_COOKIE
} from '~~/server/utils/auth'
import { consumeRateLimit } from '~~/server/utils/rate-limiter'

const ONE_MINUTE_MS = 60_000

const buildIpKey = (event: H3Event) =>
  getRequestIP(event, { xForwardedFor: true }) || 'unknown'

const resolveRule = (event: H3Event) => {
  const path = event.path || ''
  const method = getMethod(event)

  if (method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/editor-login')) {
    return {
      key: `login:${buildIpKey(event)}`,
      maxRequests: 10,
      windowMs: ONE_MINUTE_MS
    }
  }

  if (/^\/api\/editor\/writable-tables\/[^/]+\/(insert|update)$/.test(path)) {
    const sessionToken = getCookie(event, EDITOR_SESSION_COOKIE)
    const keyPart = sessionToken || buildIpKey(event)
    return {
      key: `editor-write:${keyPart}`,
      maxRequests: 30,
      windowMs: ONE_MINUTE_MS
    }
  }

  if (path.startsWith('/api/admin')) {
    const sessionToken = getCookie(event, ADMIN_SESSION_COOKIE)
    const keyPart = sessionToken || buildIpKey(event)
    return {
      key: `admin-api:${keyPart}`,
      maxRequests: 120,
      windowMs: ONE_MINUTE_MS
    }
  }

  if (path.startsWith('/api/dashboards/') || path.startsWith('/d/')) {
    return {
      key: `public-dashboard:${buildIpKey(event)}`,
      maxRequests: 60,
      windowMs: ONE_MINUTE_MS
    }
  }

  return null
}

export default defineEventHandler((event) => {
  const rule = resolveRule(event)
  if (!rule) {
    return
  }

  const result = consumeRateLimit(rule.key, rule.maxRequests, rule.windowMs)
  setHeader(event, 'X-RateLimit-Limit', String(rule.maxRequests))
  setHeader(event, 'X-RateLimit-Remaining', String(result.remaining))

  if (result.allowed) {
    return
  }

  setHeader(event, 'Retry-After', String(Math.ceil(result.resetMs / 1000)))

  throw createError({
    statusCode: 429,
    statusMessage: 'Rate limit exceeded'
  })
})
