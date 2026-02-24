<script setup lang="ts">
import DesignAppearance from '~/components/settings/DesignAppearance.vue'
import ManageAdmins from '~/components/settings/ManageAdmins.vue'
import ShareLinkManager from '~/components/admin/ShareLinkManager.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Settings"
      description="Manage admin access and application appearance."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Settings' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <div class="mt-6 grid gap-3 md:grid-cols-2">
      <a
        href="#admins"
        class="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm hover:border-gray-300"
      >
        Manage Admins
      </a>
      <a
        href="#appearance"
        class="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm hover:border-gray-300"
      >
        Design / Appearance
      </a>
      <a
        href="#shared-links"
        class="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm hover:border-gray-300"
      >
        Shared Links
      </a>
    </div>

    <section id="admins" class="mt-6 rounded border border-gray-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-gray-900">Manage Admins</h2>
      <p class="mt-1 text-sm text-gray-600">Manage additional admin accounts.</p>
      <div class="mt-6">
        <ManageAdmins />
      </div>
    </section>

    <section
      id="appearance"
      class="mt-6 rounded border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 class="text-lg font-semibold text-gray-900">Design / Appearance</h2>
      <p class="mt-1 text-sm text-gray-600">
        Configure brand colors and typography used across admin and shared pages.
      </p>
      <div class="mt-6">
        <DesignAppearance />
      </div>
    </section>

    <section
      id="shared-links"
      class="mt-6 rounded border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 class="text-lg font-semibold text-gray-900">Shared Links</h2>
      <p class="mt-1 text-sm text-gray-600">
        Review, search, and delete active shared links across dashboards.
      </p>
      <div class="mt-6">
        <ShareLinkManager />
      </div>
    </section>
  </section>
</template>
