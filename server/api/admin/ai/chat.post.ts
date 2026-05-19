import { createError, defineEventHandler, getRequestURL, readBody } from 'h3'
import type { H3Event } from 'h3'
import {
  getAiProviderRuntimeSettings,
  getAiProviderSettings
} from '~~/server/utils/app-settings-store'
import type { AiProviderId } from '~~/shared/ai/provider-settings'

const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek'
}

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

  const [aiProviderSettings, publicProviderSettings] = await Promise.all([
    getAiProviderRuntimeSettings(),
    getAiProviderSettings()
  ])
  if (!aiProviderSettings) {
    const providerLabel = AI_PROVIDER_LABELS[publicProviderSettings.activeProvider]
    const missingDetails = publicProviderSettings.activeProvider === 'azure-openai'
      ? 'API key, endpoint, and deployment'
      : 'API key'

    throw createError({
      statusCode: 400,
      statusMessage: `${providerLabel} is selected but missing required credentials (${missingDetails}). Configure it in AI Provider settings.`
    })
  }

  try {
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
        aiProviderSettings
      }
    })
  } catch (error) {
    const statusMessage = error instanceof Error ? error.message : 'AI service request failed'
    throw createError({ statusCode: 502, statusMessage })
  }
})
