<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{
  to?: string
  label: string
  icon: Component
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'click'): void
}>()
</script>

<template>
  <NuxtLink
    v-if="props.to"
    :to="props.to"
    class="settings-nav-card group flex flex-col items-center text-center"
    :class="{ 'settings-nav-card--active': props.active }"
  >
    <span
      class="settings-nav-card__box flex h-[84px] w-[75.5px] flex-col items-center rounded-[8px] border border-[#f2f2f2] bg-white py-2 text-black shadow-none outline outline-1 outline-black"
    >
      <span class="flex min-h-0 flex-1 items-center justify-center">
        <component :is="props.icon" class="h-[32px] w-[30px]" />
      </span>
      <span class="settings-nav-card__label w-full px-1 py-1 text-center text-[11px] font-medium leading-tight text-gray-700">
        {{ props.label }}
      </span>
    </span>
  </NuxtLink>

  <button
    v-else
    type="button"
    class="settings-nav-card group flex flex-col items-center text-center"
    :class="{
      'settings-nav-card--active': props.active,
      'settings-nav-card--disabled': props.disabled
    }"
    :disabled="props.disabled"
    @click="emit('click')"
  >
    <span
      class="settings-nav-card__box flex h-[84px] w-[75.5px] flex-col items-center rounded-[8px] border border-[#f2f2f2] bg-white py-2 text-black shadow-none outline outline-1 outline-black"
    >
      <span class="flex min-h-0 flex-1 items-center justify-center">
        <component :is="props.icon" class="h-[32px] w-[30px]" />
      </span>
      <span class="settings-nav-card__label w-full px-1 py-1 text-center text-[11px] font-medium leading-tight text-gray-700">
        {{ props.label }}
      </span>
    </span>
  </button>
</template>

<style scoped>
.settings-nav-card__label {
  transition: background-color 0.2s ease, color 0.2s ease;
}

.settings-nav-card:hover .settings-nav-card__label,
.settings-nav-card--active .settings-nav-card__label {
  background-color: var(--color-brand-secondary, #d97556);
  color: #ffffff;
}

.settings-nav-card--disabled {
  cursor: not-allowed;
}

.settings-nav-card--disabled .settings-nav-card__box {
  border-color: #d1d5db;
  background-color: #f9fafb;
  color: #9ca3af;
  opacity: 0.6;
}

.settings-nav-card--disabled .settings-nav-card__label {
  background-color: #e5e7eb;
  color: #6b7280;
}
</style>
