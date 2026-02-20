<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const submit = async () => {
  errorMessage.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    await navigateTo('/admin')
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unable to log in'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg px-6 py-12">
    <PageHeader
      title="Admin login"
      description="Sign in to manage dashboards."
      :breadcrumbs="[{ label: 'Login' }]"
    />

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium text-gray-700">
        Email
        <input
          v-model="email"
          type="email"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Password
        <input
          v-model="password"
          type="password"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <button
        class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
        type="submit"
        :disabled="submitting"
      >
        <LogIn class="h-4 w-4" />
        Sign in
      </button>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-red-600">
      {{ errorMessage }}
    </p>
  </section>
</template>
