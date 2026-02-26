<script setup lang="ts">
import ShareLinkManager from '~/components/admin/ShareLinkManager.vue'
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900">Shared Links</h2>
    <div class="mt-6">
      <ShareLinkManager :wrap-in-card="false" />
    </div>
  </section>
</template>
