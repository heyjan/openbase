<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'

const props = defineProps<{
  module?: ModuleConfig | null
  saving?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  (event: 'save', payload: ModuleConfig): void
  (event: 'delete', moduleId: string): void
}>()

const draft = reactive<ModuleConfig>({
  id: '',
  dashboardId: '',
  type: 'kpi_card',
  title: '',
  config: {},
  gridX: 0,
  gridY: 0,
  gridW: 6,
  gridH: 4
})

const configText = ref('{}')
const parseError = ref('')

watch(
  () => props.module,
  (module) => {
    if (!module) {
      return
    }
    draft.id = module.id
    draft.dashboardId = module.dashboardId
    draft.type = module.type
    draft.title = module.title ?? ''
    draft.config = { ...module.config }
    draft.gridX = module.gridX
    draft.gridY = module.gridY
    draft.gridW = module.gridW
    draft.gridH = module.gridH
    configText.value = JSON.stringify(module.config ?? {}, null, 2)
    parseError.value = ''
  },
  { immediate: true }
)

const save = () => {
  if (!props.module) {
    return
  }

  parseError.value = ''
  let parsedConfig: Record<string, unknown>
  try {
    const parsed = JSON.parse(configText.value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      parseError.value = 'Config must be a JSON object.'
      return
    }
    parsedConfig = parsed as Record<string, unknown>
  } catch {
    parseError.value = 'Invalid JSON config.'
    return
  }

  emit('save', {
    ...draft,
    title: draft.title?.trim() || undefined,
    config: parsedConfig
  })
}

const remove = () => {
  if (!props.module) {
    return
  }
  emit('delete', props.module.id)
}
</script>

<template>
  <aside class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div v-if="!module" class="text-sm text-gray-500">
      Select a module on the canvas to edit its settings.
    </div>

    <div v-else class="space-y-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Module Settings</h3>
        <p class="mt-1 text-xs text-gray-500">{{ module.type.replace(/_/g, ' ') }}</p>
      </div>

      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Title
        <input
          v-model="draft.title"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          X
          <input
            v-model.number="draft.gridX"
            type="number"
            min="0"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Y
          <input
            v-model.number="draft.gridY"
            type="number"
            min="0"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Width
          <input
            v-model.number="draft.gridW"
            type="number"
            min="1"
            max="12"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Height
          <input
            v-model.number="draft.gridH"
            type="number"
            min="1"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Config (JSON)
        <textarea
          v-model="configText"
          rows="8"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        ></textarea>
      </label>

      <p v-if="parseError" class="text-sm text-red-600">{{ parseError }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving...' : 'Save Module' }}
        </button>
        <button
          class="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-300 disabled:opacity-50"
          :disabled="deleting"
          @click="remove"
        >
          {{ deleting ? 'Deleting...' : 'Delete Module' }}
        </button>
      </div>
    </div>
  </aside>
</template>
