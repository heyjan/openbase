<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'

const route = useRoute()
const dashboardId = computed(() => String(route.params.id || ''))
const { getById, rotateToken } = useDashboard()

const { data: dashboard, pending, error, refresh } = useAsyncData(
  () => getById(dashboardId.value),
  { server: false }
)

const rotating = ref(false)
const rotateError = ref('')

const rotate = async () => {
  rotateError.value = ''
  rotating.value = true
  try {
    await rotateToken(dashboardId.value)
    await refresh()
  } catch (err) {
    rotateError.value =
      err instanceof Error ? err.message : 'Failed to rotate token'
  } finally {
    rotating.value = false
  }
}

const shareLink = computed(() => {
  if (!dashboard.value) {
    return ''
  }
  return `/d/${dashboard.value.slug}?token=${dashboard.value.shareToken}`
})
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-10">
    <PageHeader
      title="Share Links"
      description="Manage viewer access for this dashboard."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Share Links' }
      ]"
      :back-to="`/admin/dashboards/${dashboardId}/edit`"
      back-label="Back to dashboard"
    />

    <p v-if="pending" class="mt-6 text-sm text-gray-500">Loading…</p>
    <p v-else-if="error" class="mt-6 text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <div v-else class="mt-6 space-y-4">
      <div>
        <p class="text-sm text-gray-500">Share link</p>
        <div class="mt-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm">
          {{ shareLink }}
        </div>
      </div>

      <button
        class="inline-flex items-center rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
        :disabled="rotating"
        @click="rotate"
      >
        <RefreshCw class="h-4 w-4" />
        Rotate token
      </button>

      <p v-if="rotateError" class="text-sm text-red-600">{{ rotateError }}</p>
    </div>
  </section>
</template>
