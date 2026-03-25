import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'

const SHARED_LINK_SESSION_TTL_HOURS = 8

const toBase64Url = (value: Buffer) =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (normalized.length % 4)) % 4
  return Buffer.from(`${normalized}${'='.repeat(padding)}`, 'base64')
}

type ShareLinkSessionPayload = {
  token: string
  passwordHashDigest: string
  expiresAt: number
}

const getShareLinkSessionSecret = () => {
  const raw =
    process.env.OPENBASE_SHARE_LINK_SESSION_SECRET?.trim() ||
    process.env.OPENBASE_ENCRYPTION_KEY?.trim() ||
    ''

  if (raw) {
    return createHash('sha256').update(raw).digest()
  }

  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 500,
      statusMessage: 'OPENBASE_SHARE_LINK_SESSION_SECRET is required in production'
    })
  }

  return createHash('sha256').update('openbase-dev-share-link-session-secret').digest()
}

const signPayload = (payloadBase64: string) => {
  const signature = createHmac('sha256', getShareLinkSessionSecret())
    .update(payloadBase64)
    .digest()
  return toBase64Url(signature)
}

const digestPasswordHash = (passwordHash: string) =>
  createHash('sha256').update(passwordHash).digest('hex')

const decodeSessionPayload = (value: string): ShareLinkSessionPayload | null => {
  const [payloadBase64, signature] = value.split('.')
  if (!payloadBase64 || !signature) {
    return null
  }

  const expectedSignature = signPayload(payloadBase64)
  const signatureBuffer = fromBase64Url(signature)
  const expectedBuffer = fromBase64Url(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64).toString('utf8')) as {
      token?: unknown
      passwordHashDigest?: unknown
      expiresAt?: unknown
    }

    if (typeof payload.token !== 'string') {
      return null
    }
    if (typeof payload.passwordHashDigest !== 'string') {
      return null
    }
    if (typeof payload.expiresAt !== 'number' || Number.isNaN(payload.expiresAt)) {
      return null
    }

    return {
      token: payload.token,
      passwordHashDigest: payload.passwordHashDigest,
      expiresAt: payload.expiresAt
    }
  } catch {
    return null
  }
}

export const createShareLinkSessionValue = (
  token: string,
  passwordHash: string,
  nowMs = Date.now()
) => {
  const payload: ShareLinkSessionPayload = {
    token,
    passwordHashDigest: digestPasswordHash(passwordHash),
    expiresAt: nowMs + SHARED_LINK_SESSION_TTL_HOURS * 60 * 60 * 1000
  }

  const payloadBase64 = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = signPayload(payloadBase64)

  return {
    value: `${payloadBase64}.${signature}`,
    expiresAt: new Date(payload.expiresAt),
    maxAgeSeconds: SHARED_LINK_SESSION_TTL_HOURS * 60 * 60
  }
}

export const verifyShareLinkSessionValue = (
  value: string,
  token: string,
  passwordHash: string,
  nowMs = Date.now()
) => {
  const payload = decodeSessionPayload(value)
  if (!payload) {
    return false
  }

  if (payload.token !== token) {
    return false
  }

  if (payload.expiresAt <= nowMs) {
    return false
  }

  if (payload.passwordHashDigest !== digestPasswordHash(passwordHash)) {
    return false
  }

  return true
}
