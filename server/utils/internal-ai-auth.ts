import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'

export const requireInternalAiServiceToken = (event: H3Event) => {
  const expected = process.env.OPENBASE_AI_SERVICE_TOKEN
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'OPENBASE_AI_SERVICE_TOKEN is not configured'
    })
  }

  const authorization = getHeader(event, 'authorization')
  if (authorization !== `Bearer ${expected}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
