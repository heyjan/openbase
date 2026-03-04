<script setup lang="ts">
import { Database } from 'lucide-vue-next'
import DataSourcesManager from '~/components/admin/DataSourcesManager.vue'
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
    <div class="mb-6 flex items-center gap-2">
      <Database class="h-5 w-5 text-gray-700" />
      <h2 class="text-lg font-semibold text-gray-900">Data Sources</h2>
    </div>
    <DataSourcesManager />
  </section>
</template>
