<script setup lang="ts">
import { Link2, Palette, Users } from 'lucide-vue-next'
import SettingsNavCard from '~/components/ui/SettingsNavCard.vue'
import PageHeader from '~/components/ui/PageHeader.vue'

const route = useRoute()

const navigationItems = [
  {
    label: 'Admins',
    to: '/admin/settings/admins',
    icon: Users
  },
  {
    label: 'Appearance',
    to: '/admin/settings/appearance',
    icon: Palette
  },
  {
    label: 'Shared Links',
    to: '/admin/settings/shared-links',
    icon: Link2
  }
]

const isActive = (to: string) => route.path === to
</script>

<template>
  <section class="px-6 py-10">
    <PageHeader
      title="Settings"
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Settings' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <div class="mt-6 flex flex-col gap-6 lg:flex-row">
      <aside class="w-full shrink-0 lg:w-[180px]">
        <nav class="grid grid-cols-2 gap-3 sm:w-[180px]">
          <SettingsNavCard
            v-for="item in navigationItems"
            :key="item.to"
            :to="item.to"
            :label="item.label"
            :icon="item.icon"
            :active="isActive(item.to)"
          />
        </nav>
      </aside>

      <div class="min-w-0 flex-1">
        <NuxtPage />
      </div>
    </div>
  </section>
</template>
