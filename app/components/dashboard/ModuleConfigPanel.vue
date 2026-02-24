<script setup lang="ts">
import {
  isTextModuleType,
  type ModuleConfig,
  type TextModuleType
} from '~/types/module'
import type { ModuleTemplate } from '~/types/template'

type FontSizePreset = 'M' | 'L' | 'XL'

const props = defineProps<{
  module?: ModuleConfig | null
  saving?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  (event: 'save', payload: ModuleConfig): void
  (event: 'delete', moduleId: string): void
}>()

const { list: listTemplates, create: createTemplate } = useTemplates()
const toast = useAppToast()
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const fontSizePresets: FontSizePreset[] = ['M', 'L', 'XL']

const textModuleDefaults: Record<
  TextModuleType,
  { text: string; fontSize: FontSizePreset; color: string }
> = {
  header: {
    text: 'Section Title',
    fontSize: 'L',
    color: '#1a1a1a'
  },
  subheader: {
    text: 'Subsection',
    fontSize: 'M',
    color: '#6b7280'
  }
}

const draft = reactive<ModuleConfig>({
  id: '',
  dashboardId: '',
  type: 'kpi_card',
  title: '',
  config: {},
  gridX: 0,
  gridY: 0,
  gridW: 6,
  gridH: 5
})

const textConfigDraft = reactive<{
  text: string
  fontSize: FontSizePreset
  color: string
}>({
  text: textModuleDefaults.header.text,
  fontSize: textModuleDefaults.header.fontSize,
  color: textModuleDefaults.header.color
})

const configText = ref('{}')
const parseError = ref('')
const templates = ref<ModuleTemplate[]>([])
const templatesLoading = ref(false)
const templateError = ref('')
const selectedTemplateId = ref('')
const templateName = ref('')
const savingTemplate = ref(false)

const isTextModule = computed(
  () => !!props.module && isTextModuleType(props.module.type)
)

const colorHexWithoutHash = computed({
  get: () =>
    textConfigDraft.color.startsWith('#')
      ? textConfigDraft.color.slice(1)
      : textConfigDraft.color,
  set: (value: string) => {
    const sanitized = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    textConfigDraft.color = sanitized ? `#${sanitized}` : '#'
  }
})

const filteredTemplates = computed(() => {
  if (!props.module) {
    return [] as ModuleTemplate[]
  }
  return templates.value.filter((template) => template.type === props.module?.type)
})

const parseConfigText = () => {
  const parsed = JSON.parse(configText.value || '{}')
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config must be a JSON object.')
  }
  return parsed as Record<string, unknown>
}

const normalizeTextConfig = (
  moduleType: TextModuleType,
  config: Record<string, unknown> | null | undefined
) => {
  const defaults = textModuleDefaults[moduleType]
  const record = config ?? {}

  const text =
    typeof record.text === 'string' && record.text.trim()
      ? record.text.trim()
      : defaults.text
  const fontSize = record.fontSize
  const color = record.color

  return {
    text,
    fontSize:
      fontSize === 'M' || fontSize === 'L' || fontSize === 'XL'
        ? fontSize
        : defaults.fontSize,
    color:
      typeof color === 'string' && HEX_COLOR_REGEX.test(color)
        ? color
        : defaults.color
  }
}

const parseTextConfig = () => {
  const text = textConfigDraft.text.trim()
  if (!text) {
    throw new Error('Text is required.')
  }

  if (!fontSizePresets.includes(textConfigDraft.fontSize)) {
    throw new Error('Font size must be one of M, L, or XL.')
  }

  const color = textConfigDraft.color.trim()
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new Error('Color must be a 6-digit hex value like #1a1a1a.')
  }

  return {
    text,
    fontSize: textConfigDraft.fontSize,
    color
  } as Record<string, unknown>
}

const parseDraftConfig = () => {
  if (!props.module) {
    return {}
  }
  return isTextModuleType(props.module.type) ? parseTextConfig() : parseConfigText()
}

const loadTemplates = async () => {
  templatesLoading.value = true
  templateError.value = ''
  try {
    templates.value = await listTemplates()
  } catch (error) {
    templateError.value =
      error instanceof Error ? error.message : 'Failed to load module templates'
  } finally {
    templatesLoading.value = false
  }
}

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
    templateError.value = ''
    selectedTemplateId.value = ''
    templateName.value =
      module.title?.trim() ||
      (isTextModuleType(module.type)
        ? module.type === 'header'
          ? 'Header'
          : 'Subheader'
        : '')

    if (isTextModuleType(module.type)) {
      const normalized = normalizeTextConfig(module.type, module.config)
      textConfigDraft.text = normalized.text
      textConfigDraft.fontSize = normalized.fontSize
      textConfigDraft.color = normalized.color
    }
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
    parsedConfig = parseDraftConfig()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Invalid module config.'
    return
  }

  emit('save', {
    ...draft,
    title: isTextModule.value ? undefined : draft.title?.trim() || undefined,
    config: parsedConfig
  })
}

const remove = () => {
  if (!props.module) {
    return
  }
  emit('delete', props.module.id)
}

const applyTemplate = () => {
  if (!props.module || !selectedTemplateId.value) {
    return
  }

  const template = templates.value.find((item) => item.id === selectedTemplateId.value)
  if (!template) {
    return
  }

  if (isTextModuleType(props.module.type)) {
    const normalized = normalizeTextConfig(props.module.type, template.config ?? {})
    textConfigDraft.text = normalized.text
    textConfigDraft.fontSize = normalized.fontSize
    textConfigDraft.color = normalized.color
  } else {
    draft.title = draft.title?.trim() || template.name
    configText.value = JSON.stringify(template.config ?? {}, null, 2)
  }

  parseError.value = ''
  toast.success('Template applied', 'Save module to persist these changes.')
}

const saveCurrentAsTemplate = async () => {
  if (!props.module) {
    return
  }

  let parsedConfig: Record<string, unknown>
  try {
    parsedConfig = parseDraftConfig()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Invalid module config.'
    return
  }

  if (!templateName.value.trim()) {
    templateError.value = 'Template name is required.'
    return
  }

  savingTemplate.value = true
  templateError.value = ''
  try {
    await createTemplate({
      name: templateName.value.trim(),
      type: props.module.type,
      config: parsedConfig
    })
    await loadTemplates()
    toast.success('Template saved', 'You can now apply it to modules of this type.')
  } catch (error) {
    templateError.value =
      error instanceof Error ? error.message : 'Failed to save module template'
  } finally {
    savingTemplate.value = false
  }
}

onMounted(loadTemplates)
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

      <label
        v-if="!isTextModule"
        class="block text-xs font-medium uppercase tracking-wide text-gray-600"
      >
        Title
        <input
          v-model="draft.title"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <div v-if="isTextModule" class="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Text
          <input
            v-model="textConfigDraft.text"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Section title..."
          />
        </label>

        <div class="text-xs font-medium uppercase tracking-wide text-gray-600">
          Font Size
          <div class="mt-1 inline-flex rounded border border-gray-300 bg-white p-0.5">
            <button
              v-for="size in fontSizePresets"
              :key="size"
              type="button"
              class="rounded px-3 py-1 text-xs font-semibold"
              :class="
                textConfigDraft.fontSize === size
                  ? 'bg-brand-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              "
              @click="textConfigDraft.fontSize = size"
            >
              {{ size }}
            </button>
          </div>
        </div>

        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Color
          <div class="mt-1 flex items-center gap-2">
            <div class="rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-500">
              #
            </div>
            <input
              v-model="colorHexWithoutHash"
              class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              maxlength="6"
              placeholder="1a1a1a"
            />
            <span
              class="h-8 w-8 rounded border border-gray-300"
              :style="{
                backgroundColor:
                  textConfigDraft.color.length === 7 ? textConfigDraft.color : 'transparent'
              }"
            ></span>
          </div>
        </label>
      </div>

      <label
        v-else
        class="block text-xs font-medium uppercase tracking-wide text-gray-600"
      >
        Config (JSON)
        <textarea
          v-model="configText"
          rows="8"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        ></textarea>
      </label>

      <p v-if="parseError" class="text-sm text-red-600">{{ parseError }}</p>

      <div class="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Template Library
        </h4>

        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Apply Template
          <select
            v-model="selectedTemplateId"
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Select template…</option>
            <option
              v-for="template in filteredTemplates"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}
            </option>
          </select>
        </label>

        <button
          class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
          :disabled="!selectedTemplateId"
          @click="applyTemplate"
        >
          Apply template
        </button>

        <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
          Save Current Config As Template
          <input
            v-model="templateName"
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Template name"
          />
        </label>

        <button
          class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
          :disabled="savingTemplate || templatesLoading"
          @click="saveCurrentAsTemplate"
        >
          {{ savingTemplate ? 'Saving template...' : 'Save as template' }}
        </button>

        <p v-if="templateError" class="text-sm text-red-600">{{ templateError }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="rounded bg-brand-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
