<script setup lang="ts">
import { X } from 'lucide-vue-next'
import ShareLinkManager from '~/components/admin/ShareLinkManager.vue'

const route = useRoute()
const router = useRouter()
const dashboardId = computed(() => String(route.params.id || ''))
const asyncKey = computed(() => `admin-dashboard-share-${dashboardId.value}`)
const { getById } = useDashboard()

const { data: dashboard, pending, error, refresh } = await useAsyncData(
  asyncKey,
  () => getById(dashboardId.value),
  {
    watch: [dashboardId]
  }
)

const onShareLinksChanged = async () => {
  await refresh()
}

const close = () => {
  if (process.client && window.history.length > 1) {
    router.back()
    return
  }

  navigateTo(`/admin/dashboards/${dashboardId.value}/edit`)
}
</script>

<template>
  <section
    class="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-6"
    @click.self="close"
  >
    <div class="w-full max-w-5xl rounded border border-gray-200 bg-white shadow-xl">
      <div class="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
        <h1 class="text-lg font-semibold text-gray-900">Share Links</h1>
        <button
          type="button"
          class="rounded border border-gray-200 p-1.5 text-gray-600 hover:border-gray-300"
          @click="close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="max-h-[76vh] overflow-y-auto p-4">
        <p v-if="pending" class="text-sm text-gray-500">Loading dashboard...</p>
        <p v-else-if="error" class="text-sm text-red-600">
          {{ error?.message || 'Failed to load dashboard.' }}
        </p>

        <div v-else class="space-y-4">
          <ShareLinkManager
            :dashboard-id="dashboardId"
            :show-title="false"
            :allow-delete="false"
            :show-search="false"
            @changed="onShareLinksChanged"
          />
        </div>
      </div>
    </div>
  </section>
</template>
