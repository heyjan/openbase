<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import { getPasswordScore, passwordStrengthLabel } from '~/utils/password'

const route = useRoute()
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})

const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const score = computed(() => getPasswordScore(password.value))
const strength = computed(() => passwordStrengthLabel(score.value))
const valid = computed(() => password.value.length >= 10 && score.value >= 4)

const submit = async () => {
  errorMessage.value = ''
  submitting.value = true
  try {
    await $fetch('/api/setup/complete', {
      method: 'POST',
      body: {
        token: token.value,
        password: password.value
      }
    })
    await navigateTo('/admin')
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unable to complete setup'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg px-6 py-12">
    <PageHeader
      title="Create your password"
      description="Choose a strong password to finish setup."
      :breadcrumbs="[{ label: 'Setup', to: '/setup' }, { label: 'Password' }]"
      back-to="/setup"
      back-label="Back to setup"
    />

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium text-gray-700">
        Password
        <input
          v-model="password"
          type="password"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <div class="text-sm text-gray-600">
        Strength:
        <span
          :class="{
            'text-red-600': strength === 'weak',
            'text-amber-600': strength === 'medium',
            'text-emerald-600': strength === 'strong'
          }"
        >
          {{ strength }}
        </span>
        <p class="mt-1 text-xs text-gray-500">
          Use 10+ characters with a mix of cases, numbers, and symbols.
        </p>
      </div>

      <button
        class="inline-flex items-center rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white"
        type="submit"
        :disabled="submitting || !valid || !token"
      >
        <CheckCircle class="h-4 w-4" />
        Finish setup
      </button>
    </form>

    <p v-if="errorMessage" class="mt-4 text-sm text-red-600">
      {{ errorMessage }}
    </p>
    <p v-if="!token" class="mt-4 text-sm text-red-600">
      Missing setup token.
    </p>
  </section>
</template>
