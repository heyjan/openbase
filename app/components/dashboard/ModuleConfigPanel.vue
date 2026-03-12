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
const { list: listWritableTables } = useWritableTables()
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
const writableTables = ref<Array<{ id: string; tableName: string; dataSourceName?: string }>>([])
const writableTablesLoading = ref(false)
const writableTableError = ref('')
const showTitle = ref(true)
const selectedWritableTableId = ref('')
const tabbedEnabled = ref(false)
const tabGroupSeparator = ref('')
const tabDefault = ref('')
const tabSharedColumns = ref<string[]>([])
const tabSharedColumnsText = ref('')
const templates = ref<ModuleTemplate[]>([])
const templatesLoading = ref(false)
const templateError = ref('')
const selectedTemplateId = ref('')
const templateName = ref('')
const savingTemplate = ref(false)

const isTextModule = computed(
  () => !!props.module && isTextModuleType(props.module.type)
)
const isDataTableModule = computed(() => props.module?.type === 'data_table')

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

const parseConfigTextSafe = () => {
  try {
    return parseConfigText()
  } catch {
    return null
  }
}

const readWritableTableId = (config: Record<string, unknown> | null | undefined) => {
  if (!config) {
    return ''
  }
  const candidate = config.writableTableId ?? config.writable_table_id
  return typeof candidate === 'string' ? candidate.trim() : ''
}

const readConfigBoolean = (
  config: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = false
) => {
  if (!config) {
    return fallback
  }

  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'boolean') {
      return value
    }
  }

  return fallback
}

const readConfigString = (
  config: Record<string, unknown> | null | undefined,
  keys: string[]
) => {
  if (!config) {
    return ''
  }

  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const readConfigRawString = (
  config: Record<string, unknown> | null | undefined,
  keys: string[]
) => {
  if (!config) {
    return ''
  }

  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string') {
      return value
    }
  }

  return ''
}

const readConfigStringArray = (
  config: Record<string, unknown> | null | undefined,
  keys: string[]
) => {
  if (!config) {
    return [] as string[]
  }

  for (const key of keys) {
    const value = config[key]
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      return value as string[]
    }
  }

  return [] as string[]
}

const readShowTitleConfig = (config: Record<string, unknown> | null | undefined) =>
  readConfigBoolean(config, ['showTitle', 'show_title'], true)

const syncDataTableTabControls = (config: Record<string, unknown> | null | undefined) => {
  tabbedEnabled.value = readConfigBoolean(config, ['tabbed'], false)
  tabGroupSeparator.value = readConfigRawString(config, ['tabGroupSeparator', 'tab_group_separator'])
  tabDefault.value = readConfigString(config, ['tabDefault', 'tab_default'])
  tabSharedColumns.value = readConfigStringArray(config, ['tabSharedColumns', 'tab_shared_columns'])
  tabSharedColumnsText.value = tabSharedColumns.value.join(', ')
}

const tabSharedColumnOptions = computed(() => {
  const parsed = parseConfigTextSafe()
  if (!parsed) {
    return [] as string[]
  }

  const configuredOrder = readConfigStringArray(parsed, ['columnOrder', 'column_order'])
  const configuredVisible = readConfigStringArray(parsed, ['visibleColumns', 'visible_columns'])
  const columns = configuredOrder.length ? configuredOrder : configuredVisible

  return columns.filter(
    (column, index, source) =>
      column.trim().length > 0 && source.indexOf(column) === index
  )
})

const applyDataTableConfigPatch = (
  patcher: (config: Record<string, unknown>) => void
) => {
  if (!isDataTableModule.value) {
    return
  }

  let parsedConfig: Record<string, unknown>
  try {
    parsedConfig = parseConfigText()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Invalid module config.'
    return
  }

  patcher(parsedConfig)
  configText.value = JSON.stringify(parsedConfig, null, 2)
  parseError.value = ''
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

const loadWritableTables = async () => {
  writableTablesLoading.value = true
  writableTableError.value = ''
  try {
    const items = await listWritableTables()
    writableTables.value = items.map((table) => ({
      id: table.id,
      tableName: table.tableName,
      dataSourceName: table.dataSourceName
    }))
  } catch (error) {
    writableTableError.value =
      error instanceof Error ? error.message : 'Failed to load writable tables'
  } finally {
    writableTablesLoading.value = false
  }
}

const onWritableTableChange = () => {
  if (!isDataTableModule.value) {
    return
  }

  let parsedConfig: Record<string, unknown>
  try {
    parsedConfig = parseConfigText()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Invalid module config.'
    return
  }

  const nextValue = selectedWritableTableId.value.trim()
  if (nextValue) {
    parsedConfig.writableTableId = nextValue
  } else {
    delete parsedConfig.writableTableId
  }
  delete parsedConfig.writable_table_id

  configText.value = JSON.stringify(parsedConfig, null, 2)
  parseError.value = ''
}

const onShowTitleChange = () => {
  if (!props.module || isTextModuleType(props.module.type)) {
    return
  }

  let parsedConfig: Record<string, unknown>
  try {
    parsedConfig = parseConfigText()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Invalid module config.'
    showTitle.value = readShowTitleConfig(props.module?.config)
    return
  }

  if (showTitle.value) {
    delete parsedConfig.showTitle
  } else {
    parsedConfig.showTitle = false
  }
  delete parsedConfig.show_title

  configText.value = JSON.stringify(parsedConfig, null, 2)
  parseError.value = ''
}

const onTabEnabledChange = () => {
  applyDataTableConfigPatch((config) => {
    config.tabbed = tabbedEnabled.value
  })
}

const onTabGroupSeparatorChange = () => {
  applyDataTableConfigPatch((config) => {
    const nextValue = tabGroupSeparator.value
    if (nextValue.length) {
      config.tabGroupSeparator = nextValue
    } else {
      delete config.tabGroupSeparator
    }
    delete config.tab_group_separator
  })
}

const onTabDefaultChange = () => {
  applyDataTableConfigPatch((config) => {
    const nextValue = tabDefault.value.trim()
    if (nextValue) {
      config.tabDefault = nextValue
    } else {
      delete config.tabDefault
    }
    delete config.tab_default
  })
}

const setTabSharedColumns = (columns: string[]) => {
  const deduplicated = columns.filter(
    (column, index, source) =>
      column.trim().length > 0 && source.indexOf(column) === index
  )

  tabSharedColumns.value = deduplicated
  tabSharedColumnsText.value = deduplicated.join(', ')

  applyDataTableConfigPatch((config) => {
    if (deduplicated.length) {
      config.tabSharedColumns = deduplicated
    } else {
      delete config.tabSharedColumns
    }
    delete config.tab_shared_columns
  })
}

const onTabSharedColumnsTextChange = () => {
  const nextColumns = tabSharedColumnsText.value
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
  setTabSharedColumns(nextColumns)
}

const onToggleTabSharedColumn = (column: string) => {
  const next = new Set(tabSharedColumns.value)
  if (next.has(column)) {
    next.delete(column)
  } else {
    next.add(column)
  }
  setTabSharedColumns(
    tabSharedColumnOptions.value.filter((entry) => next.has(entry))
  )
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
    showTitle.value = readShowTitleConfig(module.config)
    selectedWritableTableId.value = readWritableTableId(module.config)
    syncDataTableTabControls(module.config)
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

watch(
  () => [configText.value, isDataTableModule.value, isTextModule.value] as const,
  () => {
    if (isTextModule.value) {
      showTitle.value = true
      selectedWritableTableId.value = ''
      tabbedEnabled.value = false
      tabGroupSeparator.value = ''
      tabDefault.value = ''
      tabSharedColumns.value = []
      tabSharedColumnsText.value = ''
      return
    }

    const parsedConfig = parseConfigTextSafe()
    if (parsedConfig) {
      const nextShowTitle = readShowTitleConfig(parsedConfig)
      if (nextShowTitle !== showTitle.value) {
        showTitle.value = nextShowTitle
      }
    }

    if (!isDataTableModule.value) {
      selectedWritableTableId.value = ''
      tabbedEnabled.value = false
      tabGroupSeparator.value = ''
      tabDefault.value = ''
      tabSharedColumns.value = []
      tabSharedColumnsText.value = ''
      return
    }

    if (!parsedConfig) {
      return
    }

    const nextWritableTableId = readWritableTableId(parsedConfig)
    if (nextWritableTableId !== selectedWritableTableId.value) {
      selectedWritableTableId.value = nextWritableTableId
    }

    syncDataTableTabControls(parsedConfig)
  }
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

onMounted(() => {
  loadTemplates()
  loadWritableTables()
})
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

      <label
        v-if="!isTextModule"
        class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600"
      >
        <input
          v-model="showTitle"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300"
          @change="onShowTitleChange"
        >
        Show Title
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

      <div
        v-else
        class="block text-xs font-medium uppercase tracking-wide text-gray-600"
      >
        <span v-if="isDataTableModule" class="block">
          Writable Table
          <select
            v-model="selectedWritableTableId"
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            :disabled="writableTablesLoading"
            @change="onWritableTableChange"
          >
            <option value="">None</option>
            <option
              v-for="table in writableTables"
              :key="table.id"
              :value="table.id"
            >
              {{ table.tableName }}{{ table.dataSourceName ? ` (${table.dataSourceName})` : '' }}
            </option>
          </select>
        </span>
        <p v-if="isDataTableModule && writableTableError" class="mt-1 text-xs text-red-600">
          {{ writableTableError }}
        </p>

        <div v-if="isDataTableModule" class="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-3 normal-case">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-600">Tabbed</span>
            <input
              v-model="tabbedEnabled"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300"
              @change="onTabEnabledChange"
            >
          </div>

          <div v-if="tabbedEnabled" class="space-y-2">
            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Separator
              <input
                v-model="tabGroupSeparator"
                class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                @change="onTabGroupSeparatorChange"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Default tab
              <input
                v-model="tabDefault"
                class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                @change="onTabDefaultChange"
              />
            </label>

            <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
              Shared columns
              <input
                v-model="tabSharedColumnsText"
                class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                @change="onTabSharedColumnsTextChange"
              />
            </label>

            <div v-if="tabSharedColumnOptions.length" class="grid gap-1.5 sm:grid-cols-2">
              <label
                v-for="column in tabSharedColumnOptions"
                :key="`tab-shared-column-${column}`"
                class="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
              >
                <input
                  type="checkbox"
                  :checked="tabSharedColumns.includes(column)"
                  @change="onToggleTabSharedColumn(column)"
                >
                <span class="truncate">{{ column }}</span>
              </label>
            </div>
          </div>
        </div>

        Config (JSON)
        <textarea
          v-model="configText"
          rows="8"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        ></textarea>
      </div>

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
