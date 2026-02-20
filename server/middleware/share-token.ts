import { createError, defineEventHandler, getQuery } from 'h3'

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/dashboards') && !path.startsWith('/d/')) {
    return
  }

  const { token } = getQuery(event)
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const expectedToken = process.env.SHARE_TOKEN
  if (expectedToken && token !== expectedToken) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid share token' })
  }
})
