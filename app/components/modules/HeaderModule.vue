<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'

type FontSizePreset = 'M' | 'L' | 'XL'

const props = defineProps<{
  module: ModuleConfig
}>()

const fontSizeClassMap: Record<FontSizePreset, string> = {
  M: 'text-[1.25rem]',
  L: 'text-[1.75rem]',
  XL: 'text-[2.25rem]'
}

const configRecord = computed(() => props.module.config ?? {})

const text = computed(() => {
  const raw = configRecord.value.text
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim()
  }
  return 'Section Title'
})

const fontSize = computed<FontSizePreset>(() => {
  const raw = configRecord.value.fontSize
  return raw === 'M' || raw === 'L' || raw === 'XL' ? raw : 'L'
})

const color = computed(() => {
  const raw = configRecord.value.color
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw
  }
  return '#1a1a1a'
})
</script>

<template>
  <div class="flex h-full items-center px-4" :style="{ color }">
    <span :class="[fontSizeClassMap[fontSize], 'font-bold leading-tight']">{{ text }}</span>
  </div>
</template>
