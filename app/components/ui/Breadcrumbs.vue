<script setup lang="ts">
import { ChevronRight, Home } from 'lucide-vue-next'

export type BreadcrumbItem = {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()

const route = useRoute()

const homeTo = computed(() =>
  route.path === '/editor' || route.path.startsWith('/editor/') ? '/editor' : '/admin'
)

const homeLabel = computed(() => (homeTo.value === '/editor' ? 'Editor' : 'Admin'))
</script>

<template>
  <nav class="flex items-center gap-2 text-xs text-gray-500">
    <NuxtLink :to="homeTo" class="flex items-center gap-1 hover:text-gray-700">
      <Home class="h-3.5 w-3.5" />
      <span class="sr-only">{{ homeLabel }}</span>
    </NuxtLink>
    <template v-for="(item, index) in items" :key="`${item.label}-${index}`">
      <ChevronRight class="h-3 w-3 text-gray-400" />
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="hover:text-gray-700"
      >
        {{ item.label }}
      </NuxtLink>
      <span v-else class="text-gray-700">{{ item.label }}</span>
    </template>
  </nav>
</template>
