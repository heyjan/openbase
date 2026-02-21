<script setup lang="ts">
import { h, render } from 'vue'
import type { GridStack, GridStackNode, GridStackWidget, RenderFcn } from 'gridstack'
import type { ModuleConfig } from '~/types/module'
import DashboardGridItem from '~/components/dashboard/DashboardGridItem.vue'

const props = withDefaults(
  defineProps<{
    modules: ModuleConfig[]
    selectedModuleId?: string | null
    rowHeight?: number
  }>(),
  {
    selectedModuleId: null,
    rowHeight: 96
  }
)

const emit = defineEmits<{
  (event: 'select', moduleId: string): void
  (event: 'patch', payload: { id: string; changes: Partial<ModuleConfig> }): void
  (event: 'delete', moduleId: string): void
  (event: 'duplicate', moduleId: string): void
  (event: 'edit-query', moduleId: string): void
}>()

const gridEl = ref<HTMLElement | null>(null)
const nuxtApp = useNuxtApp()
let grid: GridStack | null = null
let gridFactory: typeof import('gridstack').GridStack | null = null
let previousRenderCB: RenderFcn | undefined
let syncingFromProps = false
const widgetMounts = new Map<string, HTMLElement>()

const dotSpacingX = computed(() => 'calc((100% - 88px) / 12 + 8px)')
const dotSpacingY = computed(() => `${props.rowHeight + 8}px`)
const moduleLayoutKey = computed(() =>
  props.modules
    .map(
      (module) =>
        `${module.id}:${module.gridX}:${module.gridY}:${Math.max(3, module.gridW)}:${Math.max(2, module.gridH)}`
    )
    .join('|')
)
const moduleById = computed(() => new Map(props.modules.map((module) => [module.id, module])))

const buildWidget = (module: ModuleConfig): GridStackWidget => ({
  id: module.id,
  x: module.gridX,
  y: module.gridY,
  w: Math.max(3, module.gridW),
  h: Math.max(2, module.gridH),
  minW: 3,
  minH: 2
})

const scrollModuleIntoView = async (moduleId: string) => {
  await nextTick()
  if (!gridEl.value) {
    return
  }
  const item = gridEl.value.querySelector<HTMLElement>(`[data-module-id="${moduleId}"]`)
  if (!item) {
    return
  }
  item.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}

const renderWidgetCard = (moduleId: string, mountEl: HTMLElement) => {
  const module = moduleById.value.get(moduleId)
  if (!module) {
    render(null, mountEl)
    return
  }

  const vnode = h(DashboardGridItem, {
    module,
    selected: props.selectedModuleId === moduleId,
    onSelect: () => emit('select', moduleId),
    onDelete: () => emit('delete', moduleId),
    onDuplicate: () => emit('duplicate', moduleId),
    onEditQuery: () => emit('edit-query', moduleId)
  })
  vnode.appContext = nuxtApp.vueApp._context
  try {
    nuxtApp.runWithContext(() => render(vnode, mountEl))
  } catch (error) {
    console.error('[DashboardEditor] Failed to render grid widget', { moduleId, error })
    mountEl.innerHTML = '<div class="p-3 text-xs text-red-600">Failed to render widget</div>'
  }
}

const renderMountedWidgets = () => {
  for (const [moduleId, mountEl] of widgetMounts.entries()) {
    if (!moduleById.value.has(moduleId)) {
      render(null, mountEl)
      widgetMounts.delete(moduleId)
      continue
    }

    renderWidgetCard(moduleId, mountEl)
  }
}

const clearMountedWidgets = () => {
  for (const mountEl of widgetMounts.values()) {
    render(null, mountEl)
  }
  widgetMounts.clear()
}

const syncGridFromProps = () => {
  if (!grid) {
    return
  }

  syncingFromProps = true
  try {
    grid.load(props.modules.map((module) => buildWidget(module)))
  } finally {
    syncingFromProps = false
  }

  if (process.dev && props.modules.length > 0 && widgetMounts.size === 0) {
    console.warn('[DashboardEditor] Grid loaded modules but renderCB mounted no widgets')
  }

  renderMountedWidgets()
}

const onGridChange = (_event: Event, items: GridStackNode[]) => {
  if (syncingFromProps) {
    return
  }

  for (const item of items) {
    const id = (typeof item.id === 'string' && item.id) || item.el?.dataset.moduleId || ''

    if (!id) {
      continue
    }

    const current = props.modules.find((module) => module.id === id)
    if (!current) {
      continue
    }

    const next = {
      gridX: item.x ?? current.gridX,
      gridY: item.y ?? current.gridY,
      gridW: Math.max(3, item.w ?? current.gridW),
      gridH: Math.max(2, item.h ?? current.gridH)
    }

    if (
      next.gridX === current.gridX &&
      next.gridY === current.gridY &&
      next.gridW === current.gridW &&
      next.gridH === current.gridH
    ) {
      continue
    }

    emit('patch', { id, changes: next })
  }
}

const onGridRemoved = (_event: Event, items: GridStackNode[]) => {
  for (const item of items) {
    const id = (typeof item.id === 'string' && item.id) || item.el?.dataset.moduleId || ''
    if (!id) {
      continue
    }

    const mountEl = widgetMounts.get(id) || item.el?.querySelector<HTMLElement>('.grid-stack-item-content')
    if (mountEl) {
      render(null, mountEl)
    }
    widgetMounts.delete(id)
  }
}

const initGrid = async () => {
  if (!gridEl.value || grid) {
    return
  }

  try {
    await nextTick()
    if (!gridEl.value || grid) {
      return
    }

    if (!gridFactory) {
      const module = await import('gridstack')
      gridFactory = module.GridStack
    }

    previousRenderCB = gridFactory.renderCB
    gridFactory.renderCB = (mountEl, widget) => {
      const moduleId = (typeof widget.id === 'string' && widget.id) || ''
      if (!moduleId) {
        render(null, mountEl)
        return
      }

      const existingMount = widgetMounts.get(moduleId)
      if (existingMount && existingMount !== mountEl) {
        render(null, existingMount)
      }

      const itemEl = mountEl.closest<HTMLElement>('.grid-stack-item')
      if (itemEl) {
        itemEl.dataset.moduleId = moduleId
      }

      widgetMounts.set(moduleId, mountEl)
      renderWidgetCard(moduleId, mountEl)
    }

    grid = gridFactory.init(
      {
        column: 12,
        float: true,
        margin: 8,
        cellHeight: props.rowHeight,
        minRow: 1,
        alwaysShowResizeHandle: true,
        draggable: {
          handle: '.module-drag-handle'
        },
        resizable: {
          handles: 'n,ne,e,se,s,sw,w,nw'
        }
      },
      gridEl.value
    )

    grid.on('change', onGridChange)
    grid.on('removed', onGridRemoved)
    syncGridFromProps()
  } catch (error) {
    console.error('[DashboardEditor] Grid initialization failed', error)
  }
}

onMounted(() => {
  initGrid()
})

watch(
  gridEl,
  (el) => {
    if (el) {
      initGrid()
    }
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (grid) {
    grid.off('change', onGridChange)
    grid.off('removed', onGridRemoved)
    grid.destroy(false)
    grid = null
  }

  clearMountedWidgets()

  if (gridFactory) {
    gridFactory.renderCB = previousRenderCB
  }
})

watch(
  () => props.rowHeight,
  (height) => {
    grid?.cellHeight(height)
  }
)

watch(
  moduleLayoutKey,
  () => {
    syncGridFromProps()
  }
)

watch(
  () => props.modules,
  () => {
    renderMountedWidgets()
  },
  { deep: true }
)

watch(
  () => props.selectedModuleId,
  () => {
    renderMountedWidgets()
  }
)

watch(
  () => props.selectedModuleId,
  (moduleId) => {
    if (!moduleId) {
      return
    }
    scrollModuleIntoView(moduleId)
  }
)
</script>

<template>
  <ClientOnly>
    <section class="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Dashboard Canvas</h3>
          <p class="text-xs text-gray-500">Drag modules, resize, and snap to the 12-column grid.</p>
        </div>
        <p class="text-xs text-gray-500">{{ modules.length }} modules</p>
      </div>

      <div class="max-h-[78vh] overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3">
        <div
          ref="gridEl"
          class="grid-stack min-h-[640px]"
          :style="{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: `${dotSpacingX} ${dotSpacingY}`
          }"
        ></div>
      </div>
    </section>

    <template #fallback>
      <section class="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-gray-500">Loading canvas...</p>
      </section>
    </template>
  </ClientOnly>
</template>

<style scoped>
:deep(.grid-stack-item .ui-resizable-handle) {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  border: 1px solid #9ca3af;
  background: #ffffff;
  opacity: 0.9;
}

:deep(.grid-stack-item .ui-resizable-handle::before),
:deep(.grid-stack-item .ui-resizable-handle::after) {
  display: none;
}
</style>
