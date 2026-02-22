<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'
import type { ToastTone } from '~/types/toast'

const { toasts, dismiss } = useAppToast()

const toneClasses: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900'
}

const toneIconClasses: Record<ToastTone, string> = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  info: 'text-blue-600'
}
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[90] flex w-full max-w-sm flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto rounded border px-3 py-2 shadow-sm"
        :class="toneClasses[toast.tone]"
      >
        <div class="flex items-start gap-2">
          <div class="mt-0.5" :class="toneIconClasses[toast.tone]">
            <CheckCircle2 v-if="toast.tone === 'success'" class="h-4 w-4" />
            <AlertCircle v-else-if="toast.tone === 'error'" class="h-4 w-4" />
            <Info v-else class="h-4 w-4" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ toast.title }}</p>
            <p v-if="toast.description" class="text-xs opacity-80">{{ toast.description }}</p>
          </div>

          <button
            class="rounded p-0.5 opacity-70 transition hover:opacity-100"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
