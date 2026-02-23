<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
import ToastViewport from '~/components/ui/ToastViewport.vue'

const loggingOut = ref(false)
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const toast = useAppToast()

const closeMenu = () => {
  menuOpen.value = false
}

const toggleMenu = () => {
  if (loggingOut.value) {
    return
  }
  menuOpen.value = !menuOpen.value
}

const logout = async () => {
  if (loggingOut.value) {
    return
  }

  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })
    closeMenu()
    await navigateTo('/admin/login')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to log out'
    toast.error('Unable to log out', message)
  } finally {
    loggingOut.value = false
  }
}

const onGlobalPointerDown = (event: MouseEvent) => {
  if (!menuOpen.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    closeMenu()
    return
  }

  if (!menuRef.value?.contains(target)) {
    closeMenu()
  }
}

const onGlobalKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

onMounted(() => {
  if (!process.client) {
    return
  }
  window.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('keydown', onGlobalKeyDown)
})

onBeforeUnmount(() => {
  if (!process.client) {
    return
  }
  window.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('keydown', onGlobalKeyDown)
})
</script>

<template>
  <div class="h-12 border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-full max-w-7xl items-center justify-end px-4">
      <div ref="menuRef" class="relative">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded text-white disabled:cursor-not-allowed disabled:opacity-70"
          style="background-color: hsl(15 63.1% 59.6% / 1);"
          type="button"
          :disabled="loggingOut"
          aria-label="Open settings menu"
          title="Settings"
          @click="toggleMenu"
        >
          <Settings class="h-4 w-4" />
        </button>

        <div
          v-if="menuOpen"
          class="absolute right-0 z-50 mt-2 min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button
            class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            :disabled="loggingOut"
            @click="logout"
          >
            {{ loggingOut ? 'Logging out...' : 'Logout' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ToastViewport />
</template>
