<script setup lang="ts">
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import GlobalFilterBar from '~/components/dashboard/GlobalFilterBar.vue'

const route = useRoute()
const { getPublic } = useDashboard()

const slug = computed(() => String(route.params.slug || ''))
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const tokenMissing = computed(() => !token.value)

const { data: response, pending, error } = useAsyncData(
  () => (token.value ? getPublic(slug.value, token.value) : null),
  { watch: [slug, token], server: false }
)
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <p v-if="tokenMissing" class="text-sm text-red-600">
      Missing share token.
    </p>
    <p v-else-if="pending" class="text-sm text-gray-500">Loading dashboard…</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error?.message || 'Unable to load dashboard.' }}
    </p>

    <div v-else>
      <h1 class="text-2xl font-semibold">
        {{ response?.dashboard.name }}
      </h1>
      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>
      <div class="mt-4">
        <GlobalFilterBar :modules="response?.modules || []" />
      </div>
      <div class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules yet.</p>
      </div>
    </div>
  </section>
</template>
