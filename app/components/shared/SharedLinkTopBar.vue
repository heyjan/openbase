<script setup lang="ts">
const baseUrl = ref('')
const logo = ref<string | null>(null)

const loadLogo = async () => {
  try {
    const response = await $fetch<{ logo: string | null }>('/api/settings/shared-link-logo', {
      cache: 'no-store'
    })
    logo.value = typeof response?.logo === 'string' ? response.logo : null
  } catch {
    logo.value = null
  }
}

onMounted(async () => {
  baseUrl.value = window.location.host
  await loadLogo()
})
</script>

<template>
  <header class="h-11 border-b border-gray-200 bg-white">
    <div class="flex h-full items-center justify-between px-6">
      <span class="text-sm font-medium text-gray-700">{{ baseUrl }}</span>
      <img v-if="logo" :src="logo" alt="Logo" class="max-h-8 w-auto object-contain" />
    </div>
  </header>
</template>
