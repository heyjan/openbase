import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'

type EncryptedPayload = {
  algorithm: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

const KEY_LENGTH_BYTES = 32

const toKeyFromString = (raw: string) => {
  const value = raw.trim()
  if (!value) {
    return null
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex')
  }

  const base64 = Buffer.from(value, 'base64')
  if (base64.length === KEY_LENGTH_BYTES) {
    return base64
  }

  return createHash('sha256').update(value).digest()
}

const getEncryptionKey = () => {
  const key = toKeyFromString(process.env.OPENBASE_ENCRYPTION_KEY || '')
  if (!key) {
    return null
  }
  if (key.length !== KEY_LENGTH_BYTES) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OPENBASE_ENCRYPTION_KEY must resolve to 32 bytes'
    })
  }
  return key
}

const toEncryptedPayload = (value: unknown): EncryptedPayload => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 500, statusMessage: 'Encrypted payload is invalid' })
  }

  const payload = value as Record<string, unknown>
  if (
    payload.algorithm !== 'aes-256-gcm' ||
    typeof payload.iv !== 'string' ||
    typeof payload.tag !== 'string' ||
    typeof payload.data !== 'string'
  ) {
    throw createError({ statusCode: 500, statusMessage: 'Encrypted payload is invalid' })
  }

  return payload as EncryptedPayload
}

export const isConnectionEncryptionEnabled = () => Boolean(getEncryptionKey())

export const encryptConnection = (value: Record<string, unknown>) => {
  const key = getEncryptionKey()
  if (!key) {
    return {
      connection: value,
      connectionEncrypted: false
    }
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const serialized = JSON.stringify(value)

  const encrypted = Buffer.concat([
    cipher.update(serialized, 'utf8'),
    cipher.final()
  ])

  return {
    connection: {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64')
    } as EncryptedPayload,
    connectionEncrypted: true
  }
}

export const decryptConnection = (value: unknown, encrypted: boolean) => {
  if (!encrypted) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, unknown>
    }
    return value as Record<string, unknown>
  }

  const key = getEncryptionKey()
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Encrypted data source connection requires OPENBASE_ENCRYPTION_KEY'
    })
  }

  const payload = toEncryptedPayload(value)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ])

  const parsed = JSON.parse(decrypted.toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Decrypted data source connection is invalid'
    })
  }

  return parsed as Record<string, unknown>
}
