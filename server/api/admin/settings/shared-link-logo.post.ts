import { Buffer } from 'node:buffer'
import { createError, defineEventHandler, readBody } from 'h3'
import { saveSharedLinkLogo } from '~~/server/utils/app-settings-store'

type Payload = {
  logo?: unknown
}

const DATA_URI_PREFIX_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,/
const BASE64_PAYLOAD_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const MAX_LOGO_DATA_URI_LENGTH = 700_000

const isValidBase64Payload = (value: string) => {
  if (!value.length || value.length % 4 !== 0) {
    return false
  }

  if (!BASE64_PAYLOAD_PATTERN.test(value)) {
    return false
  }

  try {
    return Buffer.from(value, 'base64').length > 0
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Payload
  const logo = typeof body?.logo === 'string' ? body.logo.trim() : ''

  if (!logo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'logo is required'
    })
  }

  if (logo.length > MAX_LOGO_DATA_URI_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: 'logo exceeds the maximum allowed size'
    })
  }

  if (!DATA_URI_PREFIX_PATTERN.test(logo)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'logo must be a base64 data URI for png, jpeg, webp, or gif'
    })
  }

  const base64Payload = logo.slice(logo.indexOf(',') + 1)
  if (!isValidBase64Payload(base64Payload)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'logo must contain a valid base64 payload'
    })
  }

  await saveSharedLinkLogo(logo)
  return { ok: true }
})
