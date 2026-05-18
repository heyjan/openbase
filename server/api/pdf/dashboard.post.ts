import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { renderPdfDashboardBuffer } from '~~/server/utils/pdf-export'

export default defineEventHandler(async (event) => {
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
