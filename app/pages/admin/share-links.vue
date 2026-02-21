<script setup lang="ts">
import PageHeader from '~/components/ui/PageHeader.vue'
import ShareLinkManager from '~/components/admin/ShareLinkManager.vue'
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Share Link Manager"
      description="Review active dashboard links and revoke tokens in bulk."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Share Links' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <div class="mt-6">
      <ShareLinkManager />
    </div>
  </section>
</template>
