<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'

const route = useRoute()
const loggingOut = ref(false)

const isActive = (target: string) => route.path === target || route.path.startsWith(`${target}/`)

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
    <header class="border-b border-gray-200 bg-white px-6 py-3">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div class="flex items-center gap-5">
          <NuxtLink to="/editor" class="text-sm font-semibold text-gray-900">Editor</NuxtLink>
          <NuxtLink
            to="/editor"
            class="text-sm"
            :class="isActive('/editor') && !isActive('/editor/data-entry') ? 'text-gray-900' : 'text-gray-600'"
          >
            Dashboards
          </NuxtLink>
          <NuxtLink
            to="/editor/data-entry"
            class="text-sm"
            :class="isActive('/editor/data-entry') ? 'text-gray-900' : 'text-gray-600'"
          >
            Data Entry
          </NuxtLink>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
          :disabled="loggingOut"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
          {{ loggingOut ? 'Logging out...' : 'Logout' }}
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-6 py-5">
      <slot />
    </main>
  </div>
</template>
