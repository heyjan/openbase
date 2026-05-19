<script setup lang="ts">
import type { AiProviderId, AiProviderPublicSettings } from '~~/shared/ai/provider-settings'
import { DEFAULT_AI_PROVIDER_SETTINGS } from '~~/shared/ai/provider-settings'

const toast = useAppToast()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Azure OpenAI', value: 'azure-openai' },
  { label: 'Anthropic Claude', value: 'anthropic' },
  { label: 'DeepSeek', value: 'deepseek' }
]

const form = reactive({
  activeProvider: DEFAULT_AI_PROVIDER_SETTINGS.activeProvider as AiProviderId,
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

const configured = reactive({
  openai: false,
  azureOpenai: false,
  anthropic: false,
  deepseek: false
})

const loadSettings = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const settings = await $fetch<AiProviderPublicSettings>('/api/admin/settings/ai-provider', {
      cache: 'no-store'
    })

    form.activeProvider = settings.activeProvider
    form.openai.model = settings.openai.model
    form.azureOpenai.deployment = settings.azureOpenai.deployment
    form.azureOpenai.endpoint = settings.azureOpenai.endpoint
    form.azureOpenai.apiVersion = settings.azureOpenai.apiVersion
    form.anthropic.model = settings.anthropic.model
    form.deepseek.model = settings.deepseek.model

    configured.openai = settings.openai.hasApiKey
    configured.azureOpenai = settings.azureOpenai.hasApiKey
    configured.anthropic = settings.anthropic.hasApiKey
    configured.deepseek = settings.deepseek.hasApiKey
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load AI provider settings'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  errorMessage.value = ''

  try {
    const settings = await $fetch<AiProviderPublicSettings>('/api/admin/settings/ai-provider', {
      method: 'PUT',
      body: form
    })

    form.openai.apiKey = ''
    form.azureOpenai.apiKey = ''
    form.anthropic.apiKey = ''
    form.deepseek.apiKey = ''

    configured.openai = settings.openai.hasApiKey
    configured.azureOpenai = settings.azureOpenai.hasApiKey
    configured.anthropic = settings.anthropic.hasApiKey
    configured.deepseek = settings.deepseek.hasApiKey
    toast.success('AI provider settings saved')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save AI provider settings'
    toast.error('Failed to save AI provider settings', errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-lg font-semibold text-gray-900">AI Provider</h2>
      <UButton
        color="neutral"
        :loading="saving"
        :disabled="loading"
        @click="save"
      >
        Save
      </UButton>
    </div>

    <div class="mt-6 space-y-6">
      <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <UFormField label="Active provider">
        <USelect
          v-model="form.activeProvider"
          :items="providerOptions"
          value-key="value"
          label-key="label"
          class="w-full max-w-sm"
        />
      </UFormField>

      <div class="grid gap-6 xl:grid-cols-2">
        <section class="rounded border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-gray-900">OpenAI</h3>
            <UBadge :color="configured.openai ? 'success' : 'neutral'" variant="soft">
              {{ configured.openai ? 'Configured' : 'Missing' }}
            </UBadge>
          </div>
          <div class="mt-4 space-y-4">
            <UFormField label="Model">
              <UInput v-model="form.openai.model" />
            </UFormField>
            <UFormField label="API key">
              <UInput v-model="form.openai.apiKey" type="password" autocomplete="new-password" placeholder="••••••••" />
            </UFormField>
          </div>
        </section>

        <section class="rounded border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-gray-900">Azure OpenAI</h3>
            <UBadge :color="configured.azureOpenai ? 'success' : 'neutral'" variant="soft">
              {{ configured.azureOpenai ? 'Configured' : 'Missing' }}
            </UBadge>
          </div>
          <div class="mt-4 space-y-4">
            <UFormField label="Deployment">
              <UInput v-model="form.azureOpenai.deployment" />
            </UFormField>
            <UFormField label="Endpoint">
              <UInput v-model="form.azureOpenai.endpoint" />
            </UFormField>
            <UFormField label="API version">
              <UInput v-model="form.azureOpenai.apiVersion" />
            </UFormField>
            <UFormField label="API key">
              <UInput v-model="form.azureOpenai.apiKey" type="password" autocomplete="new-password" placeholder="••••••••" />
            </UFormField>
          </div>
        </section>

        <section class="rounded border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-gray-900">Anthropic Claude</h3>
            <UBadge :color="configured.anthropic ? 'success' : 'neutral'" variant="soft">
              {{ configured.anthropic ? 'Configured' : 'Missing' }}
            </UBadge>
          </div>
          <div class="mt-4 space-y-4">
            <UFormField label="Model">
              <UInput v-model="form.anthropic.model" />
            </UFormField>
            <UFormField label="API key">
              <UInput v-model="form.anthropic.apiKey" type="password" autocomplete="new-password" placeholder="••••••••" />
            </UFormField>
          </div>
        </section>

        <section class="rounded border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium text-gray-900">DeepSeek</h3>
            <UBadge :color="configured.deepseek ? 'success' : 'neutral'" variant="soft">
              {{ configured.deepseek ? 'Configured' : 'Missing' }}
            </UBadge>
          </div>
          <div class="mt-4 space-y-4">
            <UFormField label="Model">
              <UInput v-model="form.deepseek.model" />
            </UFormField>
            <UFormField label="API key">
              <UInput v-model="form.deepseek.apiKey" type="password" autocomplete="new-password" placeholder="••••••••" />
            </UFormField>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
