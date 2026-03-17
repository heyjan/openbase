<script setup lang="ts">
import { Upload, X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    disabled: boolean
    modelValue: File | null
    error: string | null
    rowCount?: number | null
    columnCount?: number | null
  }>(),
  {
    rowCount: null,
    columnCount: null
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: File | null): void
}>()

const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const openFilePicker = () => {
  if (props.disabled) {
    return
  }
  fileInputRef.value?.click()
}

const selectFile = (file: File | null) => {
  emit('update:modelValue', file)
}

const onFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] || null
  selectFile(file)

  if (target) {
    target.value = ''
  }
}

const onDragEnter = () => {
  if (props.disabled) {
    return
  }
  isDragging.value = true
}

const onDragLeave = (event: DragEvent) => {
  if (!event.currentTarget) {
    isDragging.value = false
    return
  }

  const currentTarget = event.currentTarget as HTMLElement
  const relatedTarget = event.relatedTarget as Node | null
  if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
    isDragging.value = false
  }
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false

  if (props.disabled) {
    return
  }

  const file = event.dataTransfer?.files?.[0] || null
  selectFile(file)
}

const removeFile = () => {
  selectFile(null)
}
</script>

<template>
  <div>
    <div
      class="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-150"
      :class="{
        'border-gray-300 hover:border-gray-400': !isDragging && !error && !disabled,
        'border-blue-400 bg-blue-50 scale-[1.01]': isDragging && !disabled,
        'border-red-300 bg-red-50': !!error,
        'opacity-50 pointer-events-none': disabled
      }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
      @click="openFilePicker"
    >
      <template v-if="modelValue">
        <div class="flex w-full items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-gray-800">
              {{ modelValue.name }}
            </p>
            <p class="mt-1 text-xs text-gray-500">
              {{ formatFileSize(modelValue.size) }}
              <template v-if="rowCount !== null && columnCount !== null">
                - {{ rowCount.toLocaleString() }} rows - {{ columnCount.toLocaleString() }} columns
              </template>
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
            @click.stop="removeFile"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </template>

      <template v-else>
        <Upload class="mb-2 h-10 w-10 text-gray-400" :class="{ 'text-blue-500': isDragging }" />
        <p class="text-sm font-medium text-gray-700">Drag & drop your CSV file here</p>
        <p class="mt-1 text-xs text-gray-500">or click to browse - .csv files up to 10 MB</p>
      </template>

      <input
        ref="fileInputRef"
        type="file"
        accept=".csv,text/csv"
        class="hidden"
        @change="onFileSelect"
      >
    </div>

    <p v-if="error" class="mt-2 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
