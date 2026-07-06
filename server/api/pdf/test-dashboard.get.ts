import { defineEventHandler, setHeader } from 'h3'
import { createPdfTestDashboardSpec } from '~~/server/utils/pdf-export-samples'
import { renderPdfDashboardBuffer } from '~~/server/utils/pdf-export'
import { assertPdfTestEndpointsEnabled } from '~~/server/utils/pdf-test-endpoints'

export default defineEventHandler(async (event) => {
  assertPdfTestEndpointsEnabled()

  const pdf = await renderPdfDashboardBuffer(createPdfTestDashboardSpec())
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', 'inline; filename="openbase-test-dashboard.pdf"')
  setHeader(event, 'cache-control', 'no-store')
  return pdf
})
