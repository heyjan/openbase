<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'

definePageMeta({
  layout: 'editor'
})

const { list } = useEditorDashboards()

const { data: dashboards, pending, error } = useAsyncData(
  'editor-dashboards',
  list,
  { server: false }
)
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Dashboards" :breadcrumbs="[{ label: 'Editor' }, { label: 'Dashboards' }]" />

    <p v-if="pending" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error.message || 'Failed to load dashboards.' }}
    </p>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="dashboard in dashboards"
        :key="dashboard.id"
        :to="`/editor/dashboards/${dashboard.slug}`"
        class="block rounded border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300"
      >
        <p class="text-sm font-semibold text-gray-900">{{ dashboard.name }}</p>
        <p class="text-xs text-gray-500">/{{ dashboard.slug }}</p>
      </NuxtLink>

      <p v-if="!dashboards?.length" class="text-sm text-gray-500">No dashboards.</p>
    </div>
  </section>
</template>
