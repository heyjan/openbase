<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import DashboardEditor from '~/components/dashboard/DashboardEditor.vue'
import ModuleConfigPanel from '~/components/dashboard/ModuleConfigPanel.vue'
import ModulePalette from '~/components/dashboard/ModulePalette.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { ModuleConfig, ModuleType } from '~/types/module'
import type { ModuleTemplate } from '~/types/template'

const route = useRoute()
const dashboardId = computed(() => String(route.params.id || ''))
const { getById, update } = useDashboard()
const { list, create, update: updateModule, remove, updateLayout } = useModules()
const toast = useToast()

const { data: dashboard, pending, error, refresh } = useAsyncData(
  () => getById(dashboardId.value),
  { server: false }
)

const modules = ref<ModuleConfig[]>([])
const modulesPending = ref(false)
const modulesError = ref('')
const moduleActionError = ref('')
const moduleActionId = ref<string | null>(null)
const selectedModuleId = ref<string | null>(null)
const layoutDirty = ref(false)
const savingLayout = ref(false)
const confirmDeleteOpen = ref(false)
const pendingDeleteModuleId = ref<string | null>(null)

const selectedModule = computed(() =>
  modules.value.find((item) => item.id === selectedModuleId.value) ?? null
)
const selectedModuleBusy = computed(
  () => !!selectedModuleId.value && moduleActionId.value === selectedModuleId.value
)

const loadModules = async () => {
  modulesPending.value = true
  modulesError.value = ''
  try {
    modules.value = await list(dashboardId.value)
    if (!selectedModuleId.value || !modules.value.some((item) => item.id === selectedModuleId.value)) {
      selectedModuleId.value = modules.value[0]?.id ?? null
    }
    layoutDirty.value = false
  } catch (err) {
    modulesError.value =
      err instanceof Error ? err.message : 'Failed to load modules'
  } finally {
    modulesPending.value = false
  }
}

const addModule = async (payload: {
  type: ModuleType
  template?: ModuleTemplate
}) => {
  moduleActionError.value = ''
  moduleActionId.value = 'new'
  try {
    const maxGridY = modules.value.reduce((max, item) => Math.max(max, item.gridY + item.gridH), 0)
    await create(dashboardId.value, {
      type: payload.type,
      title: payload.template?.name,
      config: payload.template?.config,
      gridX: 0,
      gridY: maxGridY,
      gridW: 6,
      gridH: 4
    })
    await loadModules()
    selectedModuleId.value = modules.value[modules.value.length - 1]?.id ?? selectedModuleId.value
    toast.success(payload.template ? 'Module added from template' : 'Module added')
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to add module'
    toast.error('Failed to add module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
}

const patchModuleLocal = (payload: { id: string; changes: Partial<ModuleConfig> }) => {
  const module = modules.value.find((item) => item.id === payload.id)
  if (!module) {
    return
  }
  Object.assign(module, payload.changes)
  layoutDirty.value = true
}

const saveModule = async (module: ModuleConfig) => {
  moduleActionError.value = ''
  moduleActionId.value = module.id
  try {
    await updateModule(module.id, {
      title: module.title,
      config: module.config,
      gridX: module.gridX,
      gridY: module.gridY,
      gridW: module.gridW,
      gridH: module.gridH
    })
    await loadModules()
    selectedModuleId.value = module.id
    toast.success('Module saved')
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to update module'
    toast.error('Failed to save module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
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
  moduleActionError.value = ''
  moduleActionId.value = moduleId
  try {
    await remove(moduleId)
    await loadModules()
    selectedModuleId.value = modules.value[0]?.id ?? null
    confirmDeleteOpen.value = false
    pendingDeleteModuleId.value = null
    toast.success('Module deleted')
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to delete module'
    toast.error('Failed to delete module', moduleActionError.value)
  } finally {
    moduleActionId.value = null
  }
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
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to save layout'
    toast.error('Failed to save layout', moduleActionError.value)
  } finally {
    savingLayout.value = false
  }
}

onMounted(loadModules)
watch(dashboardId, () => {
  loadModules()
})

const form = reactive({
  name: '',
  slug: '',
  description: ''
})

watchEffect(() => {
  if (dashboard.value) {
    form.name = dashboard.value.name
    form.slug = dashboard.value.slug
    form.description = dashboard.value.description ?? ''
  }
})

const saving = ref(false)
const saveError = ref('')

const save = async () => {
  saveError.value = ''
  saving.value = true
  try {
    await update(dashboardId.value, {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined
    })
    await refresh()
    toast.success('Dashboard metadata saved')
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save'
    toast.error('Failed to save dashboard', saveError.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-7xl px-6 py-10">
    <PageHeader
      title="Edit Dashboard"
      description="Update dashboard metadata."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Edit' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    >
      <template #actions>
        <NuxtLink
          class="text-sm text-gray-700 hover:text-gray-900"
          :to="`/admin/dashboards/${dashboardId}/share`"
        >
          Manage share links →
        </NuxtLink>
      </template>
    </PageHeader>

    <p v-if="pending" class="mt-6 text-sm text-gray-500">Loading…</p>
    <p v-else-if="error" class="mt-6 text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <div v-else class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <form class="space-y-4 rounded border border-gray-200 bg-white p-4 shadow-sm" @submit.prevent="save">
        <h2 class="text-sm font-semibold text-gray-900">Dashboard Metadata</h2>

        <label class="block text-sm font-medium text-gray-700">
          Name
          <input
            v-model="form.name"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Slug
          <input
            v-model="form.slug"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Description
          <textarea
            v-model="form.description"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            rows="3"
          ></textarea>
        </label>

        <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>

        <div>
          <button
            class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
            :disabled="saving"
            type="submit"
          >
            <Save class="h-4 w-4" />
            Save metadata
          </button>
        </div>
      </form>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Modules</h2>
            <p class="text-sm text-gray-500">Compose layout visually and fine-tune module config.</p>
          </div>
          <button
            class="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="!layoutDirty || savingLayout"
            @click="saveCurrentLayout"
          >
            {{ savingLayout ? 'Saving layout...' : 'Save layout' }}
          </button>
        </div>

        <p v-if="modulesPending" class="text-sm text-gray-500">Loading modules…</p>
        <p v-else-if="modulesError" class="text-sm text-red-600">{{ modulesError }}</p>

        <div v-else class="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <ModulePalette
            :disabled="moduleActionId === 'new'"
            @add="addModule"
          />

          <DashboardEditor
            :modules="modules"
            :selected-module-id="selectedModuleId"
            @select="selectedModuleId = $event"
            @patch="patchModuleLocal"
          />

          <ModuleConfigPanel
            :module="selectedModule"
            :saving="selectedModuleBusy"
            :deleting="selectedModuleBusy"
            @save="saveModule"
            @delete="openDeleteModuleConfirm"
          />
        </div>

        <p v-if="moduleActionError" class="text-sm text-red-600">{{ moduleActionError }}</p>
      </div>
    </div>

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
