<script setup lang="ts">
import HomeChatbot from '~/components/admin/HomeChatbot.vue'
import HomeQuickActions from '~/components/admin/HomeQuickActions.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { AdminUser } from '~/types/admin'

const authFetch = process.server ? useRequestFetch() : $fetch

const { data: session } = await useAsyncData('admin-home-session', () =>
  authFetch<{ admin: AdminUser }>('/api/auth/me')
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
})

const adminName = computed(() => {
  const name = session.value?.admin?.name?.trim()
  if (name) {
    return name
  }

  const email = session.value?.admin?.email
  if (!email) {
    return 'Admin'
  }

  return email.split('@')[0] || 'Admin'
})

const headerTitle = computed(() => `${greeting.value},\n${adminName.value}`)
</script>

<template>
  <section class="space-y-6 px-6 py-5">
    <PageHeader
      :title="headerTitle"
      :breadcrumbs="[{ label: 'Home' }]"
    />

    <div class="grid gap-6 xl:grid-cols-2">
      <HomeChatbot />
      <HomeQuickActions />
    </div>
  </section>
</template>
