<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import { useExportPdf } from '~/composables/useExportPdf'

const route = useRoute()
const { getPublic } = useDashboard()

const slug = computed(() => String(route.params.slug || ''))
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const tokenMissing = computed(() => !token.value)
const gridRef = ref<HTMLElement | null>(null)

const { data: response, pending, error } = useAsyncData(
  'public-dashboard',
  () => (token.value ? getPublic(slug.value, token.value) : null),
  { watch: [slug, token] }
)

const dashboard = computed(() => {
  if (!response.value?.dashboard) {
    return null
  }
  return {
    name: response.value.dashboard.name,
    slug: response.value.dashboard.slug
  }
})

const { exporting, exportPdf } = useExportPdf({
  gridRef,
  dashboard
})
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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">
          {{ response?.dashboard.name }}
        </h1>
        <button
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="exporting || !response?.modules?.length"
          @click="exportPdf"
        >
          <Download class="h-4 w-4" />
          {{ exporting ? 'Exporting...' : 'Export PDF' }}
        </button>
      </div>
      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>
      <div ref="gridRef" class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules yet.</p>
      </div>
    </div>
  </section>
</template>
