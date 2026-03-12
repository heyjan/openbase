<script setup lang="ts">
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import SharedLinkTopBar from '~/components/shared/SharedLinkTopBar.vue'

definePageMeta({
  ssr: false
})

const route = useRoute()
const { getPublic } = useDashboard()

const slug = computed(() => String(route.params.slug || ''))
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const asyncKey = computed(() => `public-dashboard-${slug.value}-${token.value || 'missing-token'}`)
const tokenMissing = computed(() => !token.value)

const { data: response, pending, error } = useAsyncData(
  asyncKey,
  () => (token.value ? getPublic(slug.value, token.value) : null),
  {
    watch: [slug, token]
  }
)

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
