<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error'
    variant?: 'solid' | 'outline' | 'soft' | 'subtle'
  }>(),
  {
    color: 'neutral',
    variant: 'subtle'
  }
)
</script>

<template>
  <UBadge :color="props.color" :variant="props.variant">
    <slot />
  </UBadge>
</template>
