<script setup lang="ts">
import {
  LayoutDashboard,
  Link2,
  Search,
  Users
} from 'lucide-vue-next'
import SettingsNavCard from '~/components/ui/SettingsNavCard.vue'

const quickActions = [
  {
    label: 'Saved Queries',
    to: '/admin/queries',
    icon: Search
  },
  {
    label: 'Visualizations',
    to: '/admin/visualizations',
    icon: LayoutDashboard
  },
  {
    label: 'Share Links',
    to: '/admin/settings/shared-links',
    icon: Link2
  },
  {
    label: 'Editors',
    to: '/admin/editors',
    icon: Users
  },
  {
    label: 'Dashboards',
    to: '/admin/dashboards',
    icon: LayoutDashboard
  }
]
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
    <h2 class="text-xl font-semibold tracking-tight text-gray-900">Quick Actions</h2>

    <nav class="mt-4 flex p-2 flex-nowrap items-start gap-4 overflow-x-auto pb-1">
      <SettingsNavCard
        v-for="item in quickActions"
        :key="item.to"
        :to="item.to"
        :label="item.label"
        :icon="item.icon"
      />
    </nav>
  </section>
</template>
