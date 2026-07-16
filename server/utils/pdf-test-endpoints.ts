import { createError } from 'h3'

export const assertPdfTestEndpointsEnabled = () => {
  if (process.env.OPENBASE_ENABLE_PDF_TEST_ENDPOINTS === 'true') {
    return
  }

  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}
