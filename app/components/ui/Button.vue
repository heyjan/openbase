<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error'
    variant?: 'solid' | 'outline' | 'soft' | 'ghost' | 'link'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    icon?: string
    block?: boolean
  }>(),
  {
    color: 'neutral',
    variant: 'solid',
    size: 'sm',
    loading: false,
    disabled: false,
    type: 'button',
    icon: undefined,
    block: false
  }
)
</script>

<template>
  <UButton
    :color="props.color"
    :variant="props.variant"
    :size="props.size"
    :loading="props.loading"
    :disabled="props.disabled"
    :type="props.type"
    :icon="props.icon"
    :block="props.block"
  >
    <slot />
  </UButton>
</template>
