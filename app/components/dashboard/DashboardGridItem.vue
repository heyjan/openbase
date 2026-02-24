<script setup lang="ts">
import { Copy, Link, Settings2, Trash2 } from 'lucide-vue-next'
import { isTextModuleType, type ModuleConfig } from '~/types/module'
import ModuleRenderer from '~/components/modules/ModuleRenderer.vue'

type FontSizePreset = 'M' | 'L' | 'XL'

const props = defineProps<{
  module: ModuleConfig
  selected?: boolean
}>()

const emit = defineEmits<{
  (event: 'select'): void
  (event: 'delete'): void
  (event: 'duplicate'): void
  (event: 'edit-query'): void
  (event: 'update-module', payload: { id: string; changes: Partial<ModuleConfig> }): void
}>()

const moduleLabel = computed(
  () => props.module.title?.trim() || props.module.type.replace(/_/g, ' ')
)
const isTextModule = computed(() => isTextModuleType(props.module.type))
const canEditQuery = computed(() => {
  const queryId = props.module.queryVisualizationQueryId
  return typeof queryId === 'string' && queryId.trim().length > 0
})
const contentError = ref('')
const settingsOpen = ref(false)
const textValue = ref('')
const fontSizeValue = ref<FontSizePreset>('M')
const colorValue = ref('#1a1a1a')
const settingsTitleId = computed(() => `text-module-settings-title-${props.module.id}`)
const settingsDescriptionId = computed(() => `text-module-settings-description-${props.module.id}`)
const colorHexInput = computed({
  get: () => (colorValue.value.startsWith('#') ? colorValue.value.slice(1) : ''),
  set: (value: string) => {
    const sanitized = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    if (sanitized.length === 6) {
      colorValue.value = `#${sanitized}`
      updateTextModuleConfig({ color: colorValue.value })
    }
  }
})

const textModuleDefaults = computed(() =>
  props.module.type === 'header'
    ? {
        text: 'Section Title',
        fontSize: 'L' as FontSizePreset,
        color: '#1a1a1a'
      }
    : {
        text: 'Subsection',
        fontSize: 'M' as FontSizePreset,
        color: '#6b7280'
      }
)

const currentTextModuleConfig = () => {
  const defaults = textModuleDefaults.value
  const config = props.module.config ?? {}
  const text = typeof config.text === 'string' ? config.text : defaults.text
  const fontSize =
    config.fontSize === 'M' || config.fontSize === 'L' || config.fontSize === 'XL'
      ? config.fontSize
      : defaults.fontSize
  const color =
    typeof config.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(config.color)
      ? config.color
      : defaults.color

  return { text, fontSize, color }
}

const updateTextModuleConfig = (
  changes: Partial<{
    text: string
    fontSize: FontSizePreset
    color: string
  }>
) => {
  if (!isTextModule.value) {
    return
  }

  const current = currentTextModuleConfig()
  emit('update-module', {
    id: props.module.id,
    changes: {
      config: {
        ...current,
        ...changes
      }
    }
  })
}

const onTextInput = () => {
  updateTextModuleConfig({ text: textValue.value })
}

const setFontSize = (size: FontSizePreset) => {
  fontSizeValue.value = size
  updateTextModuleConfig({ fontSize: size })
}

const onColorPickerInput = () => {
  updateTextModuleConfig({ color: colorValue.value })
}

const closeSettings = () => {
  settingsOpen.value = false
}

watch(
  () => props.module,
  () => {
    if (!isTextModule.value) {
      return
    }
    const config = currentTextModuleConfig()
    textValue.value = config.text
    fontSizeValue.value = config.fontSize
    colorValue.value = config.color
  },
  { immediate: true, deep: true }
)

onErrorCaptured((error) => {
  contentError.value =
    error instanceof Error ? error.message : 'Failed to render module content'
  return false
})
</script>

<template>
  <div
    class="group relative h-full overflow-hidden rounded border bg-white shadow-sm"
    :class="[
      selected ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300',
      isTextModule ? 'module-drag-handle cursor-move' : ''
    ]"
    @click.stop="emit('select')"
  >
    <div
      v-if="!isTextModule"
      class="module-drag-handle flex cursor-move items-start justify-between gap-2 border-b border-gray-100 bg-white/95 px-3 py-2"
    >
      <div class="min-w-0 select-none">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {{ module.type.replace(/_/g, ' ') }}
        </p>
        <p class="mt-1 truncate text-sm font-medium text-gray-900">{{ moduleLabel }}</p>
      </div>

      <div
        class="flex items-center gap-1 rounded border border-gray-200 bg-white p-1 shadow"
      >
        <button
          v-if="selected && canEditQuery"
          class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
          title="Edit query"
          @click.stop="emit('edit-query')"
        >
          <Link class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="selected"
          class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
          title="Duplicate module"
          @click.stop="emit('duplicate')"
        >
          <Copy class="h-3.5 w-3.5" />
        </button>
        <button
          class="rounded border border-red-200 p-1 text-red-700 hover:border-red-300"
          title="Delete module"
          @click.stop="emit('delete')"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div
      v-if="isTextModule"
      class="absolute right-2 top-2 z-10 flex items-center gap-1 rounded border border-gray-200 bg-white/95 p-1 shadow-sm"
      @click.stop
    >
      <button
        class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
        title="Module settings"
        aria-label="Module settings"
        @click.stop="settingsOpen = true"
      >
        <Settings2 class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="selected"
        class="rounded border border-gray-200 p-1 text-gray-700 hover:border-gray-300"
        title="Duplicate module"
        @click.stop="emit('duplicate')"
      >
        <Copy class="h-3.5 w-3.5" />
      </button>
      <button
        class="rounded border border-red-200 p-1 text-red-700 hover:border-red-300"
        title="Delete module"
        @click.stop="emit('delete')"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>

    <div :class="isTextModule ? 'h-full overflow-hidden' : 'h-[calc(100%-58px)] overflow-auto p-3'">
      <p v-if="contentError" class="text-xs text-red-600">
        {{ contentError }}
      </p>
      <ModuleRenderer v-else :module="module" embedded />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isTextModule && settingsOpen"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
      @click.self="closeSettings"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-labelledby="settingsTitleId"
        :aria-describedby="settingsDescriptionId"
        class="w-full max-w-md rounded border border-gray-200 bg-white p-4 shadow-lg"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 :id="settingsTitleId" class="text-sm font-semibold text-gray-900">Module Settings</h3>
            <p :id="settingsDescriptionId" class="mt-1 text-xs text-gray-500">
              {{ module.type.replace(/_/g, ' ') }}
            </p>
          </div>
          <button
            class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300"
            @click="closeSettings"
          >
            Close
          </button>
        </div>

        <div class="space-y-3">
          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Text
            <input
              v-model="textValue"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              @input="onTextInput"
            />
          </label>

          <div class="text-xs font-medium uppercase tracking-wide text-gray-600">
            Font Size
            <div class="mt-1 inline-flex rounded border border-gray-300 bg-white p-0.5">
              <button
                v-for="size in (['M', 'L', 'XL'] as FontSizePreset[])"
                :key="size"
                type="button"
                class="rounded px-3 py-1 text-xs font-semibold"
                :class="
                  fontSizeValue === size
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                "
                @click="setFontSize(size)"
              >
                {{ size }}
              </button>
            </div>
          </div>

          <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
            Color
            <div class="mt-1 flex items-center gap-2">
              <input
                v-model="colorValue"
                type="color"
                class="h-9 w-10 rounded border border-gray-300 p-1"
                @input="onColorPickerInput"
              />
              <div class="rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-500">
                #
              </div>
              <input
                v-model="colorHexInput"
                class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                maxlength="6"
                placeholder="1a1a1a"
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  </Teleport>
</template>
