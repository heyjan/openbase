<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import Breadcrumbs from '~/components/ui/Breadcrumbs.vue'
import type { BreadcrumbItem } from '~/components/ui/Breadcrumbs.vue'

defineProps<{
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  backTo?: string
  backLabel?: string
}>()
</script>

<template>
  <header class="space-y-4">
    <Breadcrumbs v-if="breadcrumbs" :items="breadcrumbs" />
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-3">
          <NuxtLink
            v-if="backTo"
            :to="backTo"
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300"
          >
            <ArrowLeft class="h-3.5 w-3.5" />
            {{ backLabel || 'Back' }}
          </NuxtLink>
          <h1 class="text-2xl font-semibold">{{ title }}</h1>
        </div>
        <p v-if="description" class="text-sm text-gray-500">{{ description }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
