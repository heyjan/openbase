<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
import Breadcrumbs from '~/components/ui/Breadcrumbs.vue'
import CanvasToolbar from '~/components/dashboard/CanvasToolbar.vue'
import DashboardEditor from '~/components/dashboard/DashboardEditor.vue'
import DashboardMetadataModal from '~/components/dashboard/DashboardMetadataModal.vue'
import ModuleConfigPanel from '~/components/dashboard/ModuleConfigPanel.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import {
  getModuleMinGridHeight,
  getModuleMinGridWidth,
  isTextModuleType,
  type ModuleConfig
} from '~/types/module'
import type { QueryVisualization } from '~/types/query-visualization'

const route = useRoute()
const dashboardId = computed(() => String(route.params.id || ''))
const dashboardAsyncKey = computed(() => `admin-dashboard-edit-${dashboardId.value}`)

const { getById, update } = useDashboard()
const { list, create, update: updateModule, remove, updateLayout } = useModules()
const toast = useAppToast()
const GRID_COLUMNS = 12
const DEFAULT_MODULE_WIDTH = 6
const DEFAULT_MODULE_HEIGHT = 5
const HEADER_MODULE_WIDTH = 12
const HEADER_MODULE_HEIGHT = 1
const MODULE_AUTOSAVE_DEBOUNCE_MS = 350

const textModuleDefaults = {
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
} as const

const { data: dashboard, pending, error, refresh } = await useAsyncData(
  dashboardAsyncKey,
  () => getById(dashboardId.value),
  {
    watch: [dashboardId]
  }
)

const modules = ref<ModuleConfig[]>([])
const modulesPending = ref(false)
const modulesError = ref('')
const moduleActionError = ref('')
const moduleActionId = ref<string | null>(null)
const layoutDirty = ref(false)
const savingLayout = ref(false)
const selectedModuleId = ref<string | null>(null)
const metadataModalOpen = ref(false)
const metadataSaving = ref(false)
const metadataError = ref('')
const confirmDeleteOpen = ref(false)
const pendingDeleteModuleId = ref<string | null>(null)
const canvasWidthMode = ref<'fixed' | 'full'>('fixed')
const overlapNoticeShown = ref(false)

const form = reactive({
  name: '',
  slug: '',
  description: ''
})

const loadModules = async () => {
  modulesPending.value = true
  modulesError.value = ''

  try {
    const loaded = await list(dashboardId.value)
    const { normalized, changed } = normalizeOverlappingLayout(loaded)
    modules.value = normalized

    if (!selectedModuleId.value || !modules.value.some((module) => module.id === selectedModuleId.value)) {
      selectedModuleId.value = modules.value[0]?.id ?? null
    }

    layoutDirty.value = changed
    if (changed && !overlapNoticeShown.value && process.client) {
      overlapNoticeShown.value = true
      toast.info(
        'Detected overlapping modules',
        'Cards were separated locally. Save layout to persist.'
      )
    }
  } catch (error) {
    modulesError.value = error instanceof Error ? error.message : 'Failed to load modules'
  } finally {
    modulesPending.value = false
  }
}

const placeModuleAtEnd = (module: Pick<ModuleConfig, 'gridY' | 'gridH'>[]) =>
  module.reduce((max, current) => Math.max(max, current.gridY + current.gridH), 0)

const placeRectAtEnd = (rects: Array<{ y: number; h: number }>) =>
  rects.reduce((max, current) => Math.max(max, current.y + current.h), 0)

const selectedModule = computed(
  () => modules.value.find((module) => module.id === selectedModuleId.value) ?? null
)
const selectedModuleBusy = computed(
  () => !!selectedModuleId.value && moduleActionId.value === selectedModuleId.value
)
const showSideConfigPanel = computed(
  () => !selectedModule.value || !isTextModuleType(selectedModule.value.type)
)
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const moduleSaveSeq = new Map<string, number>()

const rectanglesOverlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) => {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

const findOpenSlot = (
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
  input: {
    width: number
    height: number
    preferredX: number
    preferredY: number
  }
) => {
  const width = Math.max(3, input.width)
  const height = Math.max(1, input.height)
  const maxX = Math.max(0, GRID_COLUMNS - width)
  const preferredX = Math.min(Math.max(input.preferredX, 0), maxX)
  const preferredY = Math.max(0, input.preferredY)
  const maxExistingY = placeRectAtEnd(occupied)
  const searchUntil = Math.max(maxExistingY + height + 8, preferredY + 48)

  const xCandidates = Array.from({ length: maxX + 1 }, (_, index) => index).sort(
    (a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX)
  )

  for (let y = preferredY; y <= searchUntil; y += 1) {
    for (const x of xCandidates) {
      const candidate = { x, y, w: width, h: height }
      const collides = occupied.some((item) => rectanglesOverlap(candidate, item))
      if (!collides) {
        return { x, y }
      }
    }
  }

  return { x: preferredX, y: maxExistingY }
}

const findNearestOpenSlot = (input: {
  width: number
  height: number
  preferredX: number
  preferredY: number
}) =>
  findOpenSlot(
    modules.value.map((module) => ({
      x: module.gridX,
      y: module.gridY,
      w: module.gridW,
      h: module.gridH
    })),
    input
  )

const normalizeOverlappingLayout = (items: ModuleConfig[]) => {
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = []
  let changed = false

  const normalized = items.map((module) => {
    const gridW = Math.max(getModuleMinGridWidth(module.type), module.gridW)
    const gridH = Math.max(getModuleMinGridHeight(module.type), module.gridH)
    const slot = findOpenSlot(occupied, {
      width: gridW,
      height: gridH,
      preferredX: module.gridX,
      preferredY: module.gridY
    })

    const nextModule = {
      ...module,
      gridX: slot.x,
      gridY: slot.y,
      gridW,
      gridH
    }

    if (
      nextModule.gridX !== module.gridX ||
      nextModule.gridY !== module.gridY ||
      nextModule.gridW !== module.gridW ||
      nextModule.gridH !== module.gridH
    ) {
      changed = true
    }

    occupied.push({
      x: nextModule.gridX,
      y: nextModule.gridY,
      w: nextModule.gridW,
      h: nextModule.gridH
    })

    return nextModule
  })

  return { normalized, changed }
}

const addFromVisualization = async (visualization: QueryVisualization) => {
  if (moduleActionId.value) {
    return
  }
  moduleActionId.value = 'new-visualization'
  moduleActionError.value = ''

  try {
    const maxGridY = placeModuleAtEnd(modules.value)
    const slot = findNearestOpenSlot({
      width: DEFAULT_MODULE_WIDTH,
      height: DEFAULT_MODULE_HEIGHT,
      preferredX: 0,
      preferredY: maxGridY
    })
    const config = JSON.parse(JSON.stringify(visualization.config ?? {})) as Record<string, unknown>

    const createdModule = await create(dashboardId.value, {
      type: visualization.moduleType,
      title: visualization.name,
      config,
      queryVisualizationId: visualization.id,
      gridX: slot.x,
      gridY: slot.y,
      gridW: DEFAULT_MODULE_WIDTH,
      gridH: DEFAULT_MODULE_HEIGHT
    })

    modules.value = [...modules.value, createdModule]
    selectedModuleId.value = createdModule.id
    toast.success('Visualization added to canvas')
  } catch (error) {
    moduleActionError.value = error instanceof Error ? error.message : 'Failed to add visualization'
    toast.error('Failed to add visualization', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const addTextModule = async (type: 'header' | 'subheader') => {
  if (moduleActionId.value) {
    return
  }

  const actionId = `new-${type}`
  moduleActionId.value = actionId
  moduleActionError.value = ''

  try {
    const maxGridY = placeModuleAtEnd(modules.value)
    const slot = findNearestOpenSlot({
      width: HEADER_MODULE_WIDTH,
      height: HEADER_MODULE_HEIGHT,
      preferredX: 0,
      preferredY: maxGridY
    })

    const createdModule = await create(dashboardId.value, {
      type,
      config: { ...textModuleDefaults[type] },
      gridX: slot.x,
      gridY: slot.y,
      gridW: HEADER_MODULE_WIDTH,
      gridH: HEADER_MODULE_HEIGHT
    })

    modules.value = [...modules.value, createdModule]
    selectedModuleId.value = createdModule.id
    toast.success(type === 'header' ? 'Header added to canvas' : 'Subheader added to canvas')
  } catch (error) {
    moduleActionError.value =
      error instanceof Error
        ? error.message
        : `Failed to add ${type === 'header' ? 'header' : 'subheader'}`
    toast.error('Failed to add module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const addHeaderModule = async () => addTextModule('header')

const addSubheaderModule = async () => addTextModule('subheader')

const patchModuleLocal = (payload: { id: string; changes: Partial<ModuleConfig> }) => {
  const module = modules.value.find((item) => item.id === payload.id)
  if (!module) {
    return
  }

  Object.assign(module, payload.changes)
  layoutDirty.value = true
}

const saveModule = async (payload: ModuleConfig) => {
  moduleActionId.value = payload.id
  moduleActionError.value = ''

  try {
    const updated = await updateModule(payload.id, {
      title: payload.title,
      config: payload.config,
      gridX: payload.gridX,
      gridY: payload.gridY,
      gridW: payload.gridW,
      gridH: payload.gridH
    })

    modules.value = modules.value.map((module) =>
      module.id === updated.id ? updated : module
    )
    selectedModuleId.value = updated.id
    toast.success('Module saved')
  } catch (error) {
    moduleActionError.value = error instanceof Error ? error.message : 'Failed to save module'
    toast.error('Failed to save module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const persistModuleAutosave = async (moduleId: string, saveSeq: number) => {
  const module = modules.value.find((item) => item.id === moduleId)
  if (!module) {
    return
  }

  if (isTextModuleType(module.type)) {
    const text = module.config?.text
    if (typeof text !== 'string' || !text.trim()) {
      return
    }
  }

  try {
    const updated = await updateModule(moduleId, {
      title: module.title,
      config: module.config
    })

    if (moduleSaveSeq.get(moduleId) !== saveSeq) {
      return
    }

    modules.value = modules.value.map((item) =>
      item.id === updated.id ? { ...item, ...updated } : item
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to auto-save module settings'
    moduleActionError.value = message
    toast.error('Failed to auto-save module settings', message)
  }
}

const queueModuleAutosave = (moduleId: string) => {
  const existingTimer = autoSaveTimers.get(moduleId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const nextSaveSeq = (moduleSaveSeq.get(moduleId) ?? 0) + 1
  moduleSaveSeq.set(moduleId, nextSaveSeq)

  const timer = setTimeout(() => {
    autoSaveTimers.delete(moduleId)
    persistModuleAutosave(moduleId, nextSaveSeq)
  }, MODULE_AUTOSAVE_DEBOUNCE_MS)

  autoSaveTimers.set(moduleId, timer)
}

const patchModuleContentLocal = (payload: { id: string; changes: Partial<ModuleConfig> }) => {
  const module = modules.value.find((item) => item.id === payload.id)
  if (!module) {
    return
  }

  Object.assign(module, payload.changes)
  queueModuleAutosave(payload.id)
}

const openDeleteModuleConfirm = (moduleId: string) => {
  pendingDeleteModuleId.value = moduleId
  confirmDeleteOpen.value = true
}

const deleteModule = async () => {
  if (!pendingDeleteModuleId.value) {
    return
  }

  const moduleId = pendingDeleteModuleId.value
  const pendingAutoSave = autoSaveTimers.get(moduleId)
  if (pendingAutoSave) {
    clearTimeout(pendingAutoSave)
    autoSaveTimers.delete(moduleId)
  }
  moduleSaveSeq.delete(moduleId)
  moduleActionId.value = moduleId
  moduleActionError.value = ''

  try {
    await remove(moduleId)
    await loadModules()
    selectedModuleId.value = modules.value[0]?.id ?? null
    pendingDeleteModuleId.value = null
    confirmDeleteOpen.value = false
    toast.success('Module deleted')
  } catch (error) {
    moduleActionError.value = error instanceof Error ? error.message : 'Failed to delete module'
    toast.error('Failed to delete module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const duplicateModule = async (moduleId: string) => {
  if (moduleActionId.value) {
    return
  }
  const module = modules.value.find((item) => item.id === moduleId)
  if (!module) {
    return
  }

  moduleActionId.value = `${moduleId}:duplicate`
  moduleActionError.value = ''

  try {
    const gridW = Math.max(getModuleMinGridWidth(module.type), module.gridW)
    const gridH = Math.max(getModuleMinGridHeight(module.type), module.gridH)
    const slot = findNearestOpenSlot({
      width: gridW,
      height: gridH,
      preferredX: module.gridX + gridW,
      preferredY: module.gridY
    })

    const createdModule = await create(dashboardId.value, {
      type: module.type,
      title: module.title?.trim() ? `${module.title} Copy` : undefined,
      config: JSON.parse(JSON.stringify(module.config)),
      queryVisualizationId: module.queryVisualizationId,
      gridX: slot.x,
      gridY: slot.y,
      gridW,
      gridH
    })

    modules.value = [...modules.value, createdModule]
    selectedModuleId.value = createdModule.id
    toast.success('Module duplicated')
  } catch (error) {
    moduleActionError.value = error instanceof Error ? error.message : 'Failed to duplicate module'
    toast.error('Failed to duplicate module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const editModuleQuery = async (moduleId: string) => {
  const module = modules.value.find((item) => item.id === moduleId)
  if (!module || isTextModuleType(module.type)) {
    return
  }

  const raw = module.queryVisualizationQueryId
  const queryId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'new'
  await navigateTo(`/admin/queries/${queryId}`)
}

const saveCurrentLayout = async () => {
  if (!layoutDirty.value) {
    return
  }

  savingLayout.value = true
  moduleActionError.value = ''

  try {
    await updateLayout(
      dashboardId.value,
      modules.value.map((module) => ({
        id: module.id,
        gridX: module.gridX,
        gridY: module.gridY,
        gridW: module.gridW,
        gridH: module.gridH
      }))
    )

    await loadModules()
    toast.success('Layout saved')
  } catch (error) {
    moduleActionError.value = error instanceof Error ? error.message : 'Failed to save layout'
    toast.error('Failed to save layout', moduleActionError.value)
  } finally {
    savingLayout.value = false
  }
}

const saveMetadata = async (payload: { name: string; slug: string; description: string }) => {
  metadataSaving.value = true
  metadataError.value = ''

  try {
    await update(dashboardId.value, {
      name: payload.name,
      slug: payload.slug,
      description: payload.description || undefined
    })

    await refresh()
    form.name = payload.name
    form.slug = payload.slug
    form.description = payload.description
    metadataModalOpen.value = false
    toast.success('Dashboard metadata saved')
  } catch (error) {
    metadataError.value = error instanceof Error ? error.message : 'Failed to save metadata'
    toast.error('Failed to save metadata', metadataError.value)
  } finally {
    metadataSaving.value = false
  }
}

const goToNewQuery = async () => {
  await navigateTo('/admin/queries/new')
}

const toggleCanvasWidth = () => {
  canvasWidthMode.value = canvasWidthMode.value === 'fixed' ? 'full' : 'fixed'
}

watchEffect(() => {
  if (!dashboard.value) {
    return
  }

  form.name = dashboard.value.name
  form.slug = dashboard.value.slug
  form.description = dashboard.value.description ?? ''
})

onBeforeUnmount(() => {
  for (const timer of autoSaveTimers.values()) {
    clearTimeout(timer)
  }
  autoSaveTimers.clear()
})

await loadModules()
watch(dashboardId, () => {
  loadModules()
})
</script>

<template>
  <section class="mx-auto px-6 py-10" :class="canvasWidthMode === 'fixed' ? 'max-w-[1240px]' : 'max-w-none'">
    <Breadcrumbs
      :items="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Edit' }
      ]"
    />

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold text-gray-900">Edit Dashboard</h1>
          <button
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300"
            @click="metadataModalOpen = true"
          >
            <Settings class="h-3.5 w-3.5" />
            Metadata
          </button>
        </div>
        <p class="mt-1 text-sm text-gray-500">
          Visual layout editor with drag-and-drop canvas.
        </p>
      </div>

      <NuxtLink
        class="text-sm text-gray-700 hover:text-gray-900"
        :to="`/admin/dashboards/${dashboardId}/share`"
      >
        Manage share links →
      </NuxtLink>
    </div>

    <p v-if="pending" class="mt-6 text-sm text-gray-500">Loading dashboard...</p>
    <p v-else-if="error" class="mt-6 text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <div v-else class="mt-6 space-y-4">
      <CanvasToolbar
        :width-mode="canvasWidthMode"
        :layout-dirty="layoutDirty"
        :saving-layout="savingLayout"
        :adding-visualization="moduleActionId === 'new-visualization'"
        @add-query="goToNewQuery"
        @add-visualization="addFromVisualization"
        @add-header="addHeaderModule"
        @add-subheader="addSubheaderModule"
        @toggle-width="toggleCanvasWidth"
        @save-layout="saveCurrentLayout"
      />

      <p v-if="modulesPending" class="text-sm text-gray-500">Loading modules...</p>
      <p v-else-if="modulesError" class="text-sm text-red-600">{{ modulesError }}</p>

      <div
        v-else
        :class="
          showSideConfigPanel
            ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]'
            : 'grid gap-4'
        "
      >
        <DashboardEditor
          :modules="modules"
          :selected-module-id="selectedModuleId"
          @select="selectedModuleId = $event"
          @patch="patchModuleLocal"
          @update-module="patchModuleContentLocal"
          @delete="openDeleteModuleConfirm"
          @duplicate="duplicateModule"
          @edit-query="editModuleQuery"
        />

        <ModuleConfigPanel
          v-if="showSideConfigPanel"
          :module="selectedModule"
          :saving="selectedModuleBusy"
          :deleting="selectedModuleBusy"
          @save="saveModule"
          @delete="openDeleteModuleConfirm"
        />
      </div>

      <p v-if="moduleActionError" class="text-sm text-red-600">{{ moduleActionError }}</p>
    </div>

    <DashboardMetadataModal
      v-model="metadataModalOpen"
      :name="form.name"
      :slug="form.slug"
      :description="form.description"
      :saving="metadataSaving"
      :error-message="metadataError"
      :dashboard-id="dashboardId"
      @save="saveMetadata"
    />

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete module?"
      message="This permanently removes the selected module from the dashboard."
      confirm-label="Delete module"
      confirm-tone="danger"
      :pending="pendingDeleteModuleId ? moduleActionId === pendingDeleteModuleId : false"
      @confirm="deleteModule"
    />
  </section>
</template>
