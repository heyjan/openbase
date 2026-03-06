<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import Breadcrumbs, { type BreadcrumbItem } from '~/components/ui/Breadcrumbs.vue'

const route = useRoute()
const loggingOut = ref(false)
const logoSrc = '/brain-icon-7087186-512.png'

const isEditorDashboardRoute = computed(() => route.path.startsWith('/editor/dashboards/'))
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''))

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  if (isEditorDashboardRoute.value) {
    return [
      { label: 'Dashboards', to: '/editor' },
      { label: slug.value || 'Dashboard' }
    ]
  }

  if (route.path === '/editor') {
    return [{ label: 'Dashboards' }]
  }

  return []
})

const logout = async () => {
  if (loggingOut.value) {
    return
  }

  loggingOut.value = true
  try {
    await $fetch('/api/auth/editor-logout', { method: 'POST' })
    await navigateTo('/editor/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="h-12 border-b border-gray-200 bg-white">
      <div class="flex h-full items-center justify-between gap-4 px-6">
        <div class="flex min-w-0 items-center gap-4">
          <NuxtLink to="/editor" class="flex shrink-0 items-center">
            <img :src="logoSrc" alt="Openbase" class="h-12 w-12" />
          </NuxtLink>
          <Breadcrumbs v-if="breadcrumbItems.length" :items="breadcrumbItems" />
        </div>

        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded bg-brand-secondary px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
          :disabled="loggingOut"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
          {{ loggingOut ? 'Logging out...' : 'Logout' }}
        </button>
      </div>
    </header>

    <main
      :class="
        isEditorDashboardRoute
          ? 'w-full px-6 py-5'
          : 'mx-auto w-full max-w-6xl px-6 py-5'
      "
    >
      <slot />
    </main>
  </div>
</template>
