import { createError, defineEventHandler, getRequestURL, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getAiProviderRuntimeSettings } from '~~/server/utils/app-settings-store'

const publicOriginFromEvent = (event: H3Event) => {
  const forwardedProto = event.node.req.headers['x-forwarded-proto']
  const forwardedHost = event.node.req.headers['x-forwarded-host']
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost

  if (protocol && host) {
    return `${protocol}://${host}`
  }

  const url = getRequestURL(event)
  return `${url.protocol}//${url.host}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'message is required' })
  }

  const serviceUrl = process.env.OPENBASE_AI_SERVICE_URL?.replace(/\/$/, '')
  const serviceToken = process.env.OPENBASE_AI_SERVICE_TOKEN
  if (!serviceUrl || !serviceToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AI service is not configured'
    })
  }

  try {
    const aiProviderSettings = await getAiProviderRuntimeSettings()

    return await $fetch(`${serviceUrl}/chat`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`
      },
      body: {
        message,
        publicOrigin: publicOriginFromEvent(event),
        admin: event.context.admin
          ? {
              id: event.context.admin.id,
              email: event.context.admin.email,
              name: event.context.admin.name
            }
          : undefined,
        aiProviderSettings: aiProviderSettings ?? undefined
      }
    })
  } catch (error) {
    const statusMessage = error instanceof Error ? error.message : 'AI service request failed'
    throw createError({ statusCode: 502, statusMessage })
  }
})
