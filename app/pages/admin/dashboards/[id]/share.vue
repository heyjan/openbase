<script setup lang="ts">
import { Copy, RefreshCw } from 'lucide-vue-next'
import ShareLinkManager from '~/components/admin/ShareLinkManager.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'

const route = useRoute()
const dashboardId = computed(() => String(route.params.id || ''))
const { getById, rotateToken } = useDashboard()
const toast = useToast()

const { data: dashboard, pending, error, refresh } = useAsyncData(
  () => getById(dashboardId.value),
  { server: false }
)

const rotating = ref(false)
const rotateError = ref('')
const copying = ref(false)
const confirmRotateOpen = ref(false)

const sharePath = computed(() => {
  if (!dashboard.value) {
    return ''
  }
  return `/d/${dashboard.value.slug}?token=${dashboard.value.shareToken}`
})

const rotate = async () => {
  rotateError.value = ''
  rotating.value = true
  try {
    await rotateToken(dashboardId.value)
    await refresh()
    confirmRotateOpen.value = false
    toast.success('Share token rotated')
  } catch (err) {
    rotateError.value =
      err instanceof Error ? err.message : 'Failed to rotate token'
    toast.error('Failed to rotate token', rotateError.value)
  } finally {
    rotating.value = false
  }
}

const copyShareLink = async () => {
  if (!process.client || !navigator?.clipboard || !sharePath.value) {
    rotateError.value = 'Clipboard access is not available in this browser.'
    return
  }

  rotateError.value = ''
  copying.value = true
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath.value}`)
    toast.success('Share link copied')
  } catch (err) {
    rotateError.value = err instanceof Error ? err.message : 'Failed to copy share link'
    toast.error('Failed to copy share link', rotateError.value)
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
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

    <p v-if="pending" class="mt-6 text-sm text-gray-500">Loading dashboard…</p>
    <p v-else-if="error" class="mt-6 text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <div v-else class="mt-6 space-y-6">
      <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-sm font-medium text-gray-700">Current share link</p>
        <div class="mt-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          {{ sharePath }}
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="copying"
            @click="copyShareLink"
          >
            <Copy class="h-4 w-4" />
            {{ copying ? 'Copying...' : 'Copy link' }}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="rotating"
            @click="confirmRotateOpen = true"
          >
            <RefreshCw class="h-4 w-4" />
            {{ rotating ? 'Rotating...' : 'Rotate token' }}
          </button>
        </div>
      </div>

      <ShareLinkManager :dashboard-id="dashboardId" :show-title="false" />

      <p v-if="rotateError" class="text-sm text-red-600">{{ rotateError }}</p>
    </div>

    <ConfirmDialog
      v-model="confirmRotateOpen"
      title="Rotate dashboard share token?"
      message="This invalidates the current share link and creates a new token."
      confirm-label="Rotate token"
      confirm-tone="danger"
      :pending="rotating"
      @confirm="rotate"
    />
  </section>
</template>
