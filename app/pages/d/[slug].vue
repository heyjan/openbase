<script setup lang="ts">
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import SharedLinkTopBar from '~/components/shared/SharedLinkTopBar.vue'

definePageMeta({
  ssr: false
})

const route = useRoute()
const { getPublic, verifySharedPassword } = useDashboard()

const slug = computed(() => String(route.params.slug || ''))
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const asyncKey = computed(() => `public-dashboard-${slug.value}-${token.value || 'missing-token'}`)
const tokenMissing = computed(() => !token.value)
const password = ref('')
const passwordError = ref('')
const verifyingPassword = ref(false)

const { data: response, pending, error, refresh } = useAsyncData(
  asyncKey,
  () => (token.value ? getPublic(slug.value, token.value) : null),
  {
    watch: [slug, token]
  }
)

const getErrorStatus = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const errorRecord = value as Record<string, unknown>
  const directStatus =
    typeof errorRecord.statusCode === 'number'
      ? errorRecord.statusCode
      : typeof errorRecord.status === 'number'
        ? errorRecord.status
        : null

  if (directStatus !== null) {
    return directStatus
  }

  const response = errorRecord.response
  if (response && typeof response === 'object') {
    const responseStatus = (response as Record<string, unknown>).status
    if (typeof responseStatus === 'number') {
      return responseStatus
    }
  }

  const cause = errorRecord.cause
  if (cause && typeof cause === 'object') {
    const causeRecord = cause as Record<string, unknown>
    if (typeof causeRecord.statusCode === 'number') {
      return causeRecord.statusCode
    }
    if (typeof causeRecord.status === 'number') {
      return causeRecord.status
    }
  }

  return null
}

const getErrorData = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const errorRecord = value as Record<string, unknown>
  const directData = errorRecord.data
  if (directData && typeof directData === 'object') {
    return directData as Record<string, unknown>
  }

  const response = errorRecord.response
  if (response && typeof response === 'object') {
    const payload = (response as Record<string, unknown>)._data
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>
    }
  }

  const cause = errorRecord.cause
  if (cause && typeof cause === 'object') {
    const causeData = (cause as Record<string, unknown>).data
    if (causeData && typeof causeData === 'object') {
      return causeData as Record<string, unknown>
    }
  }

  return null
}

const requiresPassword = computed(() => {
  const currentError = error.value
  if (!currentError) {
    return false
  }

  if (getErrorStatus(currentError) !== 401) {
    return false
  }

  const payload = getErrorData(currentError)
  if (payload?.requiresPassword === true) {
    return true
  }

  const message =
    currentError instanceof Error ? currentError.message : String(currentError ?? '')
  return /password required/i.test(message)
})

const submitPassword = async () => {
  if (!token.value || verifyingPassword.value) {
    return
  }

  const passwordValue = password.value.trim()
  if (!passwordValue) {
    passwordError.value = 'Password is required'
    return
  }

  verifyingPassword.value = true
  passwordError.value = ''

  try {
    await verifySharedPassword(token.value, passwordValue)
    password.value = ''
    await refresh()
  } catch (requestError) {
    const typedError = requestError as
      | (Error & { statusCode?: number })
      | null
    const message =
      typedError?.statusCode === 401
        ? 'Invalid token or password'
        : typedError instanceof Error
          ? typedError.message
          : 'Invalid token or password'
    passwordError.value = message
  } finally {
    verifyingPassword.value = false
  }
}

watch([slug, token], () => {
  password.value = ''
  passwordError.value = ''
})

const canvasWidthMode = computed(() =>
  response.value?.dashboard?.gridConfig?.canvasWidthMode === 'full' ? 'full' : 'fixed'
)
</script>

<template>
  <SharedLinkTopBar />
  <section
    class="mx-auto px-6 py-10"
    :style="{ maxWidth: canvasWidthMode === 'fixed' ? '1240px' : 'none' }"
  >
    <div v-if="tokenMissing" class="text-sm text-red-600">Missing share token.</div>
    <div v-else-if="pending" class="text-sm text-gray-500">Loading dashboard...</div>
    <div v-else-if="requiresPassword" class="mx-auto mt-8 max-w-md bg-white rounded border border-gray-200 p-5 shadow-sm">
      <form class="space-y-3" @submit.prevent="submitPassword">
        <h1 class="text-base font-semibold text-gray-900">Password Required</h1>
        <input
          v-model="password"
          type="password"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Password"
          autocomplete="current-password"
        />
        <button
          type="submit"
          class="w-full rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="verifyingPassword"
        >
          {{ verifyingPassword ? 'Verifying...' : 'Continue' }}
        </button>
      </form>
      <p v-if="passwordError" class="mt-3 text-sm text-red-600">
        {{ passwordError }}
      </p>
      <div class="mt-6 flex justify-center">
        <img src="/password-illustration.png" alt="" class="h-40 opacity-90" />
      </div>
    </div>
    <div v-else-if="error" class="text-sm text-red-600">
      {{ error?.message || 'Unable to load dashboard.' }}
    </div>

    <div v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ response?.dashboard.name }}</h1>
      </div>

      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>

      <div class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules yet.</p>
      </div>
    </div>
  </section>
</template>
