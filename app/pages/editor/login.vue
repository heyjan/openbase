<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const submit = async () => {
  submitting.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/editor-login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })
    await navigateTo('/editor')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to log in'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg px-6 py-12">
    <h1 class="text-2xl font-semibold text-gray-900">Editor login</h1>

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
        type="submit"
        class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="submitting"
      >
        <LogIn class="h-4 w-4" />
        {{ submitting ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-red-600">{{ errorMessage }}</p>
  </section>
</template>
