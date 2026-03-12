<script setup lang="ts">
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'

definePageMeta({
  layout: 'editor',
  ssr: false
})

const route = useRoute()
const { getBySlug } = useEditorDashboards()

const slug = computed(() => String(route.params.slug || ''))
const asyncKey = computed(() => `editor-dashboard-${slug.value}`)

const { data: response, pending, error } = useAsyncData(
  asyncKey,
  () => getBySlug(slug.value),
  {
    watch: [slug]
  }
)

const canvasWidthMode = computed(() =>
  response.value?.dashboard?.gridConfig?.canvasWidthMode === 'full' ? 'full' : 'fixed'
)
</script>

<template>
  <section
    class="mx-auto"
    :style="{ maxWidth: canvasWidthMode === 'fixed' ? '1240px' : 'none' }"
  >
    <p v-if="pending" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <template v-else>
      <h1 class="text-2xl font-semibold text-gray-900">{{ response?.dashboard.name }}</h1>
      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>

      <div class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules.</p>
      </div>
    </template>
  </section>
</template>
