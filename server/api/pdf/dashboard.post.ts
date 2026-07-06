import {
  createError,
  defineEventHandler,
  getCookie,
  getHeader,
  readBody,
  setHeader,
  type H3Event
} from 'h3'
import { renderPdfDashboardBuffer } from '~~/server/utils/pdf-export'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { getAdminBySessionToken } from '~~/server/utils/admin-store'

const normalizeHost = (value: string | null | undefined) =>
  value?.trim().toLowerCase() || ''

const getUrlHost = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }

  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return ''
  }
}

const assertSameOriginRequest = (event: H3Event) => {
  const requestHost = normalizeHost(getHeader(event, 'host'))
  if (!requestHost) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const originHost = getUrlHost(getHeader(event, 'origin'))
  if (originHost) {
    if (originHost === requestHost) {
      return
    }
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const refererHost = getUrlHost(getHeader(event, 'referer'))
  if (refererHost === requestHost) {
    return
  }

  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
}

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  assertSameOriginRequest(event)

  const admin = await getAdminBySessionToken(sessionToken)
  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const body = await readBody(event)
    const pdf = await renderPdfDashboardBuffer(body)
    setHeader(event, 'content-type', 'application/pdf')
    setHeader(event, 'content-disposition', 'attachment; filename="openbase-dashboard.pdf"')
    setHeader(event, 'cache-control', 'no-store')
    return pdf
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Failed to render PDF dashboard'
    })
  }
})
