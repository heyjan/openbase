<script setup lang="ts">
import { Mail } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const magicLink = ref('')

const submit = async () => {
  errorMessage.value = ''
  magicLink.value = ''
  loading.value = true
  try {
    const response = await $fetch<{ ok: boolean; magicLink?: string }>(
      '/api/setup/start',
      {
        method: 'POST',
        body: { email: email.value }
      }
    )
    if (response.magicLink) {
      magicLink.value = response.magicLink
    }
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unable to send magic link'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg px-6 py-12">
    <PageHeader
      title="Set up your admin account"
      description="Enter your email to receive a setup link."
      :breadcrumbs="[{ label: 'Setup' }]"
    />

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium text-gray-700">
        Email
        <input
          v-model="email"
          type="email"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
          required
        />
      </label>

      <button
        class="inline-flex items-center rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white"
        type="submit"
        :disabled="loading"
      >
        <Mail class="h-4 w-4" />
        Send magic link
      </button>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-red-600">
      {{ errorMessage }}
    </p>

    <div
      v-if="magicLink"
      class="mt-6 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
    >
      <p class="font-medium">Dev link (not sent via email):</p>
      <p class="mt-1 break-all">{{ magicLink }}</p>
    </div>
  </section>
</template>
