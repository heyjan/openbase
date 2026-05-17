import { defineEventHandler, setHeader } from 'h3'
import { createPdfTestDashboardSpec } from '~~/server/utils/pdf-export-samples'
import { renderPdfDashboardHtml } from '~~/server/utils/pdf-export'

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return renderPdfDashboardHtml(createPdfTestDashboardSpec())
})
