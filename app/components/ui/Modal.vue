<script setup lang="ts">
const modelValue = defineModel<boolean>({ default: false })
</script>

<template>
  <UModal v-model:open="modelValue">
    <slot />
  </UModal>
</template>
