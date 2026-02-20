<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { ModuleConfig, ModuleType } from '~/types/module'

const route = useRoute()
const dashboardId = computed(() => String(route.params.id || ''))
const { getById, update } = useDashboard()
const { list, create, update: updateModule, remove } = useModules()

const { data: dashboard, pending, error, refresh } = useAsyncData(
  () => getById(dashboardId.value),
  { server: false }
)

const modules = ref<ModuleConfig[]>([])
const modulesPending = ref(false)
const modulesError = ref('')
const moduleActionError = ref('')
const moduleActionId = ref<string | null>(null)

const moduleTypes: ModuleType[] = [
  'kpi_card',
  'time_series_chart',
  'outlier_table',
  'data_table',
  'annotation_log',
  'form_input'
]

const newModule = reactive({
  type: 'kpi_card' as ModuleType,
  title: '',
  gridX: 0,
  gridY: 0,
  gridW: 6,
  gridH: 4
})

const loadModules = async () => {
  modulesPending.value = true
  modulesError.value = ''
  try {
    modules.value = await list(dashboardId.value)
  } catch (err) {
    modulesError.value =
      err instanceof Error ? err.message : 'Failed to load modules'
  } finally {
    modulesPending.value = false
  }
}

const addModule = async () => {
  moduleActionError.value = ''
  moduleActionId.value = 'new'
  try {
    await create(dashboardId.value, {
      type: newModule.type,
      title: newModule.title || undefined,
      gridX: newModule.gridX,
      gridY: newModule.gridY,
      gridW: newModule.gridW,
      gridH: newModule.gridH
    })
    newModule.title = ''
    await loadModules()
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to add module'
  } finally {
    moduleActionId.value = null
  }
}

const saveModule = async (module: ModuleConfig) => {
  moduleActionError.value = ''
  moduleActionId.value = module.id
  try {
    await updateModule(module.id, {
      title: module.title,
      gridX: module.gridX,
      gridY: module.gridY,
      gridW: module.gridW,
      gridH: module.gridH
    })
    await loadModules()
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to update module'
  } finally {
    moduleActionId.value = null
  }
}

const deleteModule = async (moduleId: string) => {
  moduleActionError.value = ''
  moduleActionId.value = moduleId
  try {
    await remove(moduleId)
    await loadModules()
  } catch (err) {
    moduleActionError.value =
      err instanceof Error ? err.message : 'Failed to delete module'
  } finally {
    moduleActionId.value = null
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
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-10">
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

    <form v-else class="mt-6 space-y-4" @submit.prevent="save">
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

      <button
        class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
        :disabled="saving"
        type="submit"
      >
        <Save class="h-4 w-4" />
        Save changes
      </button>
    </form>

    <div class="mt-10 border-t border-gray-200 pt-8">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Modules</h2>
          <p class="text-sm text-gray-500">Add and manage dashboard modules.</p>
        </div>
      </div>

      <form class="mt-6 grid gap-4 md:grid-cols-2" @submit.prevent="addModule">
        <label class="block text-sm font-medium text-gray-700">
          Type
          <select
            v-model="newModule.type"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option v-for="type in moduleTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Title
          <input
            v-model="newModule.title"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Optional title"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Grid X
          <input
            v-model.number="newModule.gridX"
            type="number"
            min="0"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Grid Y
          <input
            v-model.number="newModule.gridY"
            type="number"
            min="0"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Grid W
          <input
            v-model.number="newModule.gridW"
            type="number"
            min="1"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Grid H
          <input
            v-model.number="newModule.gridH"
            type="number"
            min="1"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div class="md:col-span-2">
          <button
            class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
            :disabled="moduleActionId === 'new'"
            type="submit"
          >
            Add module
          </button>
        </div>
      </form>

      <p v-if="modulesPending" class="mt-6 text-sm text-gray-500">
        Loading modules…
      </p>
      <p v-else-if="modulesError" class="mt-6 text-sm text-red-600">
        {{ modulesError }}
      </p>

      <div v-else class="mt-6 space-y-4">
        <div
          v-for="module in modules"
          :key="module.id"
          class="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs font-semibold uppercase text-gray-500">Type</p>
              <p class="text-sm text-gray-700">{{ module.type }}</p>
            </div>
            <label class="block text-sm font-medium text-gray-700">
              Title
              <input
                v-model="module.title"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Grid X
              <input
                v-model.number="module.gridX"
                type="number"
                min="0"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Grid Y
              <input
                v-model.number="module.gridY"
                type="number"
                min="0"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Grid W
              <input
                v-model.number="module.gridW"
                type="number"
                min="1"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Grid H
              <input
                v-model.number="module.gridH"
                type="number"
                min="1"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <button
              class="rounded border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300"
              :disabled="moduleActionId === module.id"
              @click="saveModule(module)"
            >
              Save
            </button>
            <button
              class="rounded border border-red-200 px-3 py-1.5 text-red-700 hover:border-red-300"
              :disabled="moduleActionId === module.id"
              @click="deleteModule(module.id)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <p v-if="moduleActionError" class="mt-4 text-sm text-red-600">
        {{ moduleActionError }}
      </p>
    </div>
  </section>
</template>
