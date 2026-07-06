import { createError, defineEventHandler, getCookie, readBody, setHeader } from 'h3'
import { renderPdfDashboardBuffer } from '~~/server/utils/pdf-export'
import { ADMIN_SESSION_COOKIE } from '~~/server/utils/auth'
import { getAdminBySessionToken } from '~~/server/utils/admin-store'

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
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
