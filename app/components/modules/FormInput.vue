<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'

defineProps<{ module: ModuleConfig }>()
</script>

<template>
  <div class="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
    <p class="font-medium text-gray-700">{{ module.title || 'Form Input' }}</p>
    <p>Type: {{ module.type }}</p>
  </div>
</template>
