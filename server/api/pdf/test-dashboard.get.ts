import { createError, defineEventHandler, setHeader } from 'h3'
import { createPdfTestDashboardSpec } from '~~/server/utils/pdf-export-samples'
import { renderPdfDashboardBuffer } from '~~/server/utils/pdf-export'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const pdf = await renderPdfDashboardBuffer(createPdfTestDashboardSpec())
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', 'inline; filename="openbase-test-dashboard.pdf"')
  setHeader(event, 'cache-control', 'no-store')
  return pdf
})
