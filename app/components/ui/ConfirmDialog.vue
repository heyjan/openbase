<script setup lang="ts">
type ConfirmTone = 'danger' | 'primary'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    confirmTone?: ConfirmTone
    pending?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    confirmTone: 'danger',
    pending: false
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const close = () => {
  if (props.pending) {
    return
  }
  emit('update:modelValue', false)
  emit('cancel')
}

const confirm = () => {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
      @click.self="close"
    >
      <div class="w-full max-w-md rounded border border-gray-200 bg-white p-5 shadow-lg">
        <h3 class="text-base font-semibold text-gray-900">{{ title }}</h3>
        <p class="mt-2 text-sm text-gray-600">{{ message }}</p>

        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="pending"
            @click="close"
          >
            {{ cancelLabel }}
          </button>
          <button
            class="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            :class="
              confirmTone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-900 hover:bg-black'
            "
            :disabled="pending"
            @click="confirm"
          >
            {{ pending ? 'Working...' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
