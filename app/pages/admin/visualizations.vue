<script setup lang="ts">
import { Activity, BarChart3, LayoutList, MoreHorizontal, Table } from 'lucide-vue-next'
import type { Component } from 'vue'
import VisualizationCard from '~/components/admin/VisualizationCard.vue'
import VisualizationFolderTree from '~/components/admin/VisualizationFolderTree.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { ModuleType } from '~/types/module'
import type { QueryVisualization } from '~/types/query-visualization'
import type { VisualizationFolder } from '~/types/visualization-folder'

type TypeGroupId = 'all' | 'charts' | 'tables' | 'kpis' | 'other'

const chartTypes: ModuleType[] = [
  'time_series_chart',
  'line_chart',
  'bar_chart',
  'stacked_horizontal_bar_chart',
  'waterfall_chart',
  'radar_chart',
  'scatter_chart',
  'pie_chart'
]
const tableTypes: ModuleType[] = ['data_table', 'outlier_table']
const kpiTypes: ModuleType[] = ['kpi_card']
const groupedTypes = new Set<ModuleType>([...chartTypes, ...tableTypes, ...kpiTypes])

const typeGroups: Array<{
  id: TypeGroupId
  label: string
  icon: Component
}> = [
  { id: 'all', label: 'All', icon: LayoutList },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'tables', label: 'Tables', icon: Table },
  { id: 'kpis', label: 'KPIs', icon: Activity },
  { id: 'other', label: 'Other', icon: MoreHorizontal }
]

const { list, remove } = useQueryVisualizations()
const {
  list: listFolders,
  create: createFolder,
  update: updateFolder,
  remove: removeFolder,
  assignVisualization
} = useVisualizationFolders()
const toast = useAppToast()

const visualizations = ref<QueryVisualization[]>([])
const folders = ref<VisualizationFolder[]>([])
const loading = ref(false)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)
const selectedFolderId = ref<string | null>(null)
const selectedTypeGroup = ref<TypeGroupId>('all')

const isInTypeGroup = (visualization: QueryVisualization, groupId: TypeGroupId) => {
  if (groupId === 'all') return true
  if (groupId === 'charts') return chartTypes.includes(visualization.moduleType)
  if (groupId === 'tables') return tableTypes.includes(visualization.moduleType)
  if (groupId === 'kpis') return kpiTypes.includes(visualization.moduleType)
  return !groupedTypes.has(visualization.moduleType)
}

const filteredVisualizations = computed(() =>
  visualizations.value.filter((visualization) => {
    const matchesType = isInTypeGroup(visualization, selectedTypeGroup.value)
    const matchesFolder = selectedFolderId.value === null
      ? true
      : visualization.folderId === selectedFolderId.value
    return matchesType && matchesFolder
  })
)

const selectedLabel = computed(() => {
  const typeLabel = typeGroups.find(group => group.id === selectedTypeGroup.value)?.label ?? 'All'
  const folderLabel = selectedFolderId.value === null
    ? null
    : (folders.value.find(folder => folder.id === selectedFolderId.value)?.name ?? null)

  if (selectedTypeGroup.value === 'all' && !folderLabel) return 'All Visualizations'
  if (selectedTypeGroup.value === 'all' && folderLabel) return folderLabel
  if (!folderLabel) return typeLabel
  return `${typeLabel} • ${folderLabel}`
})

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [loadedVisualizations, loadedFolders] = await Promise.all([
      list(),
      listFolders()
    ])
    visualizations.value = loadedVisualizations
    folders.value = loadedFolders
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load visualizations'
  } finally {
    loading.value = false
  }
}

const deleteVisualization = async (id: string) => {
  if (deletingId.value) return
  if (!window.confirm('Delete this visualization?')) return

  deletingId.value = id
  errorMessage.value = ''
  try {
    await remove(id)
    visualizations.value = visualizations.value.filter(visualization => visualization.id !== id)
    toast.success('Visualization deleted')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete visualization'
    toast.error('Failed to delete visualization', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

const handleCreateFolder = async (name: string) => {
  try {
    const folder = await createFolder({ name })
    folders.value = [...folders.value, folder]
    toast.success('Folder created')
  } catch {
    toast.error('Failed to create folder')
  }
}

const handleRenameFolder = async (id: string, name: string) => {
  try {
    const updated = await updateFolder(id, { name })
    const idx = folders.value.findIndex(folder => folder.id === id)
    if (idx !== -1) {
      folders.value[idx] = updated
    }
  } catch {
    toast.error('Failed to rename folder')
  }
}

const handleDeleteFolder = async (id: string) => {
  if (!window.confirm('Delete this folder?')) return
  try {
    await removeFolder(id)
    folders.value = folders.value.filter(folder => folder.id !== id)
    visualizations.value.forEach((visualization) => {
      if (visualization.folderId === id) visualization.folderId = null
    })
    if (selectedFolderId.value === id) {
      selectedFolderId.value = null
    }
    toast.success('Folder deleted')
  } catch {
    toast.error('Failed to delete folder')
  }
}

const handleDrop = async (visualizationId: string, folderId: string | null) => {
  const visualization = visualizations.value.find(item => item.id === visualizationId)
  if (!visualization || visualization.folderId === folderId) return

  const previousFolderId = visualization.folderId
  visualization.folderId = folderId
  try {
    await assignVisualization(visualizationId, folderId)
  } catch {
    visualization.folderId = previousFolderId
    toast.error('Failed to move visualization')
  }
}

const getTypeGroupCount = (groupId: TypeGroupId) =>
  visualizations.value.filter(visualization => isInTypeGroup(visualization, groupId)).length

onMounted(loadData)
</script>

<template>
  <section class="flex h-full px-6 py-5">
    <aside class="w-56 shrink-0 border-r border-gray-200 pr-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Types
      </h3>

      <div class="space-y-1">
        <button
          v-for="group in typeGroups"
          :key="group.id"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
          :class="selectedTypeGroup === group.id
            ? 'bg-gray-100 font-medium text-gray-900'
            : 'text-gray-700 hover:bg-gray-50'"
          @click="selectedTypeGroup = group.id"
        >
          <component :is="group.icon" class="h-4 w-4 shrink-0 text-gray-400" />
          <span class="flex-1">{{ group.label }}</span>
          <span class="text-xs text-gray-400">{{ getTypeGroupCount(group.id) }}</span>
        </button>
      </div>

      <div class="my-3 border-t border-gray-200" />

      <VisualizationFolderTree
        :folders="folders"
        :selected-folder-id="selectedFolderId"
        @select="selectedFolderId = $event"
        @drop="handleDrop"
        @create="handleCreateFolder"
        @rename="handleRenameFolder"
        @delete="handleDeleteFolder"
      />
    </aside>

    <div class="min-w-0 flex-1 pl-6">
      <PageHeader
        :title="selectedLabel"
        description="Saved visualization presets linked to queries."
        :breadcrumbs="[
          { label: 'Home', to: '/admin' },
          { label: 'Visualizations' }
        ]"
        back-to="/admin"
        back-label="Back to home"
      />

      <div class="mt-4">
        <p v-if="loading" class="text-sm text-gray-500">Loading visualizations...</p>
        <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
        <p v-else-if="!filteredVisualizations.length" class="text-sm text-gray-500">
          No visualizations match the current filters.
        </p>

        <div
          v-else
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <VisualizationCard
            v-for="visualization in filteredVisualizations"
            :key="visualization.id"
            :visualization="visualization"
            @delete="deleteVisualization"
          />
        </div>
      </div>
    </div>
  </section>
</template>
