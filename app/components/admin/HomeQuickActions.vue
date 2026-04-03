<script setup lang="ts">
import {
  LayoutDashboard,
  Link2,
  Search,
  Users
} from 'lucide-vue-next'

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
  <section>
    <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
      Quick Actions
    </h3>

    <nav class="space-y-1">
      <NuxtLink
        v-for="item in quickActions"
        :key="item.to"
        :to="item.to"
        class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0 text-gray-400" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </section>
</template>
