export const AI_PROVIDER_IDS = ['openai', 'azure-openai', 'anthropic', 'deepseek'] as const

export type AiProviderId = typeof AI_PROVIDER_IDS[number]

export type AiProviderPublicSettings = {
  activeProvider: AiProviderId
  openai: {
    model: string
    hasApiKey: boolean
  }
  azureOpenai: {
    deployment: string
    endpoint: string
    apiVersion: string
    hasApiKey: boolean
  }
  anthropic: {
    model: string
    hasApiKey: boolean
  }
  deepseek: {
    model: string
    hasApiKey: boolean
  }
}

export type AiProviderRuntimeSettings = {
  activeProvider: AiProviderId
  model: string
  openai?: {
    apiKey: string
  }
  azureOpenai?: {
    deployment: string
    endpoint: string
    apiVersion: string
    apiKey: string
  }
  anthropic?: {
    apiKey: string
  }
  deepseek?: {
    apiKey: string
  }
}

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderPublicSettings = {
  activeProvider: 'openai',
  openai: {
    model: 'gpt-5.2',
    hasApiKey: false
  },
  azureOpenai: {
    deployment: '',
    endpoint: '',
    apiVersion: '2024-07-01-preview',
    hasApiKey: false
  },
  anthropic: {
    model: 'claude-sonnet-4-6',
    hasApiKey: false
  },
  deepseek: {
    model: 'deepseek-chat',
    hasApiKey: false
  }
}

export const isAiProviderId = (value: unknown): value is AiProviderId =>
  typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)
