<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'

definePageMeta({
  layout: 'editor'
})

const { listWritableTables } = useEditorDataEntry()

const { data: tables, pending, error } = useAsyncData(
  'editor-writable-tables',
  listWritableTables,
  { server: false }
)
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Data Entry" :breadcrumbs="[{ label: 'Editor' }, { label: 'Data Entry' }]" />

    <p v-if="pending" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error.message || 'Failed to load writable tables.' }}
    </p>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="table in tables"
        :key="table.id"
        :to="`/editor/data-entry/${table.id}`"
        class="block rounded border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300"
      >
        <p class="text-sm font-semibold text-gray-900">{{ table.tableName }}</p>
        <p class="text-xs text-gray-500">{{ table.dataSourceName }}</p>
      </NuxtLink>

      <p v-if="!tables?.length" class="text-sm text-gray-500">No writable tables.</p>
    </div>
  </section>
</template>
