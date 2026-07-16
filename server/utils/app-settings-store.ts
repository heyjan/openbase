import type { DesignSettings } from '~~/shared/design-settings'
import {
  DEFAULT_DESIGN_SETTINGS,
  coerceDesignSettings
} from '~~/shared/design-settings'
import type {
  AiProviderId,
  AiProviderPublicSettings,
  AiProviderRuntimeSettings
} from '~~/shared/ai/provider-settings'
import {
  DEFAULT_AI_PROVIDER_SETTINGS,
  isAiProviderId
} from '~~/shared/ai/provider-settings'
import { decryptConnection, encryptConnection } from './crypto'
import { query } from './db'

type AppSettingsRow = {
  value: unknown
}

type SharedLinkLogoSettings = {
  logo?: unknown
}

type AiProviderSecretSettings = {
  activeProvider: AiProviderId
  openai: {
    model: string
    apiKey: string
  }
  azureOpenai: {
    deployment: string
    endpoint: string
    apiVersion: string
    apiKey: string
  }
  anthropic: {
    model: string
    apiKey: string
  }
  deepseek: {
    model: string
    apiKey: string
  }
}

type AiProviderStoredSettings = {
  encrypted: boolean
  value: unknown
}

export type AiProviderSettingsInput = {
  activeProvider?: unknown
  openai?: {
    model?: unknown
    apiKey?: unknown
  }
  azureOpenai?: {
    deployment?: unknown
    endpoint?: unknown
    apiVersion?: unknown
    apiKey?: unknown
  }
  anthropic?: {
    model?: unknown
    apiKey?: unknown
  }
  deepseek?: {
    model?: unknown
    apiKey?: unknown
  }
}

let ensureAppSettingsTablePromise: Promise<void> | null = null

const ensureAppSettingsTable = async () => {
  if (!ensureAppSettingsTablePromise) {
    ensureAppSettingsTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS app_settings (
           id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           key         VARCHAR(100) UNIQUE NOT NULL,
           value       JSONB NOT NULL,
           updated_at  TIMESTAMPTZ DEFAULT now()
         )`
      )
    })()
  }

  await ensureAppSettingsTablePromise
}

export const getDesignSettings = async (): Promise<DesignSettings> => {
  await ensureAppSettingsTable()

  const result = await query<AppSettingsRow>(
    `SELECT value
     FROM app_settings
     WHERE key = 'design'
     LIMIT 1`
  )

  const row = result.rows[0]
  if (!row) {
    return DEFAULT_DESIGN_SETTINGS
  }

  return coerceDesignSettings(row.value)
}

export const saveDesignSettings = async (settings: DesignSettings) => {
  await ensureAppSettingsTable()

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('design', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now()`,
    [JSON.stringify(settings)]
  )
}

const defaultAiProviderSecrets = (): AiProviderSecretSettings => ({
  activeProvider: DEFAULT_AI_PROVIDER_SETTINGS.activeProvider,
  openai: {
    model: DEFAULT_AI_PROVIDER_SETTINGS.openai.model,
    apiKey: ''
  },
  azureOpenai: {
    deployment: DEFAULT_AI_PROVIDER_SETTINGS.azureOpenai.deployment,
    endpoint: DEFAULT_AI_PROVIDER_SETTINGS.azureOpenai.endpoint,
    apiVersion: DEFAULT_AI_PROVIDER_SETTINGS.azureOpenai.apiVersion,
    apiKey: ''
  },
  anthropic: {
    model: DEFAULT_AI_PROVIDER_SETTINGS.anthropic.model,
    apiKey: ''
  },
  deepseek: {
    model: DEFAULT_AI_PROVIDER_SETTINGS.deepseek.model,
    apiKey: ''
  }
})

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback

const coerceAiProviderSecrets = (value: unknown): AiProviderSecretSettings => {
  const defaults = defaultAiProviderSecrets()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const record = value as Record<string, unknown>
  const activeProvider = isAiProviderId(record.activeProvider)
    ? record.activeProvider
    : defaults.activeProvider
  const openai = record.openai && typeof record.openai === 'object'
    ? record.openai as Record<string, unknown>
    : {}
  const azureOpenai = record.azureOpenai && typeof record.azureOpenai === 'object'
    ? record.azureOpenai as Record<string, unknown>
    : {}
  const anthropic = record.anthropic && typeof record.anthropic === 'object'
    ? record.anthropic as Record<string, unknown>
    : {}
  const deepseek = record.deepseek && typeof record.deepseek === 'object'
    ? record.deepseek as Record<string, unknown>
    : {}

  return {
    activeProvider,
    openai: {
      model: asString(openai.model, defaults.openai.model) || defaults.openai.model,
      apiKey: asString(openai.apiKey)
    },
    azureOpenai: {
      deployment: asString(azureOpenai.deployment),
      endpoint: asString(azureOpenai.endpoint),
      apiVersion: asString(azureOpenai.apiVersion, defaults.azureOpenai.apiVersion) || defaults.azureOpenai.apiVersion,
      apiKey: asString(azureOpenai.apiKey)
    },
    anthropic: {
      model: asString(anthropic.model, defaults.anthropic.model) || defaults.anthropic.model,
      apiKey: asString(anthropic.apiKey)
    },
    deepseek: {
      model: asString(deepseek.model, defaults.deepseek.model) || defaults.deepseek.model,
      apiKey: asString(deepseek.apiKey)
    }
  }
}

const toPublicAiProviderSettings = (
  settings: AiProviderSecretSettings
): AiProviderPublicSettings => ({
  activeProvider: settings.activeProvider,
  openai: {
    model: settings.openai.model,
    hasApiKey: Boolean(settings.openai.apiKey)
  },
  azureOpenai: {
    deployment: settings.azureOpenai.deployment,
    endpoint: settings.azureOpenai.endpoint,
    apiVersion: settings.azureOpenai.apiVersion,
    hasApiKey: Boolean(settings.azureOpenai.apiKey)
  },
  anthropic: {
    model: settings.anthropic.model,
    hasApiKey: Boolean(settings.anthropic.apiKey)
  },
  deepseek: {
    model: settings.deepseek.model,
    hasApiKey: Boolean(settings.deepseek.apiKey)
  }
})

const getAiProviderSecretSettings = async (): Promise<AiProviderSecretSettings> => {
  await ensureAppSettingsTable()

  const result = await query<AppSettingsRow>(
    `SELECT value
     FROM app_settings
     WHERE key = 'ai_provider'
     LIMIT 1`
  )
  const row = result.rows[0]
  if (!row || !row.value || typeof row.value !== 'object') {
    return defaultAiProviderSecrets()
  }

  const stored = row.value as AiProviderStoredSettings
  if ('encrypted' in stored && 'value' in stored) {
    return coerceAiProviderSecrets(decryptConnection(stored.value, Boolean(stored.encrypted)))
  }

  return coerceAiProviderSecrets(row.value)
}

export const getAiProviderSettings = async (): Promise<AiProviderPublicSettings> =>
  toPublicAiProviderSettings(await getAiProviderSecretSettings())

const applyProviderInput = (
  existing: AiProviderSecretSettings,
  input: AiProviderSettingsInput
): AiProviderSecretSettings => {
  const next: AiProviderSecretSettings = structuredClone(existing)

  if (isAiProviderId(input.activeProvider)) {
    next.activeProvider = input.activeProvider
  }
  if (input.openai) {
    next.openai.model = asString(input.openai.model, next.openai.model) || next.openai.model
    const apiKey = asString(input.openai.apiKey)
    if (apiKey) next.openai.apiKey = apiKey
  }
  if (input.azureOpenai) {
    next.azureOpenai.deployment = asString(input.azureOpenai.deployment, next.azureOpenai.deployment)
    next.azureOpenai.endpoint = asString(input.azureOpenai.endpoint, next.azureOpenai.endpoint)
    next.azureOpenai.apiVersion = asString(input.azureOpenai.apiVersion, next.azureOpenai.apiVersion) || next.azureOpenai.apiVersion
    const apiKey = asString(input.azureOpenai.apiKey)
    if (apiKey) next.azureOpenai.apiKey = apiKey
  }
  if (input.anthropic) {
    next.anthropic.model = asString(input.anthropic.model, next.anthropic.model) || next.anthropic.model
    const apiKey = asString(input.anthropic.apiKey)
    if (apiKey) next.anthropic.apiKey = apiKey
  }
  if (input.deepseek) {
    next.deepseek.model = asString(input.deepseek.model, next.deepseek.model) || next.deepseek.model
    const apiKey = asString(input.deepseek.apiKey)
    if (apiKey) next.deepseek.apiKey = apiKey
  }

  return next
}

export const saveAiProviderSettings = async (
  input: AiProviderSettingsInput
): Promise<AiProviderPublicSettings> => {
  await ensureAppSettingsTable()

  const settings = applyProviderInput(await getAiProviderSecretSettings(), input)
  const encrypted = encryptConnection(settings)
  const stored: AiProviderStoredSettings = {
    encrypted: encrypted.connectionEncrypted,
    value: encrypted.connection
  }

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('ai_provider', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now()`,
    [JSON.stringify(stored)]
  )

  return toPublicAiProviderSettings(settings)
}

export const getAiProviderRuntimeSettings = async (): Promise<AiProviderRuntimeSettings | null> => {
  const settings = await getAiProviderSecretSettings()

  if (settings.activeProvider === 'openai') {
    return settings.openai.apiKey
      ? {
          activeProvider: 'openai',
          model: `openai:${settings.openai.model}`,
          openai: { apiKey: settings.openai.apiKey }
        }
      : null
  }

  if (settings.activeProvider === 'azure-openai') {
    return settings.azureOpenai.apiKey && settings.azureOpenai.endpoint && settings.azureOpenai.deployment
      ? {
          activeProvider: 'azure-openai',
          model: `azure-openai:${settings.azureOpenai.deployment}`,
          azureOpenai: {
            deployment: settings.azureOpenai.deployment,
            endpoint: settings.azureOpenai.endpoint,
            apiVersion: settings.azureOpenai.apiVersion,
            apiKey: settings.azureOpenai.apiKey
          }
        }
      : null
  }

  if (settings.activeProvider === 'anthropic') {
    return settings.anthropic.apiKey
      ? {
          activeProvider: 'anthropic',
          model: `anthropic:${settings.anthropic.model}`,
          anthropic: { apiKey: settings.anthropic.apiKey }
        }
      : null
  }

  if (settings.activeProvider === 'deepseek') {
    return settings.deepseek.apiKey
      ? {
          activeProvider: 'deepseek',
          model: `deepseek:${settings.deepseek.model}`,
          deepseek: { apiKey: settings.deepseek.apiKey }
        }
      : null
  }

  return null
}

export const getSharedLinkLogo = async (): Promise<string | null> => {
  await ensureAppSettingsTable()

  const result = await query<AppSettingsRow>(
    `SELECT value
     FROM app_settings
     WHERE key = 'shared_link_logo'
     LIMIT 1`
  )

  const row = result.rows[0]
  if (!row || !row.value || typeof row.value !== 'object') {
    return null
  }

  const logo = (row.value as SharedLinkLogoSettings).logo
  if (typeof logo !== 'string' || !logo.length) {
    return null
  }

  return logo
}

export const saveSharedLinkLogo = async (dataUri: string) => {
  await ensureAppSettingsTable()

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('shared_link_logo', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now()`,
    [JSON.stringify({ logo: dataUri })]
  )
}

export const deleteSharedLinkLogo = async () => {
  await ensureAppSettingsTable()

  await query(
    `DELETE FROM app_settings
     WHERE key = 'shared_link_logo'`
  )
}
