<script setup lang="ts">
import { Database } from 'lucide-vue-next'
import DataSourcesManager from '~/components/admin/DataSourcesManager.vue'
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <Database class="h-5 w-5 text-gray-700" />
      <h2 class="text-lg font-semibold text-gray-900">Data Sources</h2>
    </div>
    <DataSourcesManager />
  </section>
</template>
