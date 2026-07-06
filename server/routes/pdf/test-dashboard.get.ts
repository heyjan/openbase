import { createError, defineEventHandler, setHeader } from 'h3'
import { createPdfTestDashboardSpec } from '~~/server/utils/pdf-export-samples'
import { renderPdfDashboardHtml } from '~~/server/utils/pdf-export'

export default defineEventHandler((event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return renderPdfDashboardHtml(createPdfTestDashboardSpec())
})
