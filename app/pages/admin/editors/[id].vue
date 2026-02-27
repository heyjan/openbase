<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'

const route = useRoute()
const editorId = computed(() => String(route.params.id || ''))
const { getPermissions, updatePermissions } = useEditors()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const actionError = ref('')
const successMessage = ref('')

const editorName = ref('')
const availableDashboards = ref<Array<{ id: string; name: string; slug: string }>>([])
const availableWritableTables = ref<
  Array<{ id: string; tableName: string; dataSourceName?: string }>
>([])

const dashboardIds = ref<string[]>([])
const writableTableIds = ref<string[]>([])

const loadPermissions = async () => {
  if (!editorId.value) {
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const payload = await getPermissions(editorId.value)
    editorName.value = payload.editor.name || payload.editor.email
    availableDashboards.value = payload.availableDashboards.map((dashboard) => ({
      id: dashboard.id,
      name: dashboard.name,
      slug: dashboard.slug
    }))
    availableWritableTables.value = payload.availableWritableTables.map((table) => ({
      id: table.id,
      tableName: table.tableName,
      dataSourceName: table.dataSourceName
    }))
    dashboardIds.value = [...payload.dashboardIds]
    writableTableIds.value = [...payload.writableTableIds]
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Failed to load permissions'
  } finally {
    loading.value = false
  }
}

const toggleId = (collection: { value: string[] }, id: string) => {
  if (collection.value.includes(id)) {
    collection.value = collection.value.filter((value) => value !== id)
    return
  }
  collection.value = [...collection.value, id]
}

const save = async () => {
  if (!editorId.value) {
    return
  }

  saving.value = true
  actionError.value = ''
  successMessage.value = ''

  try {
    await updatePermissions(editorId.value, {
      dashboardIds: dashboardIds.value,
      writableTableIds: writableTableIds.value
    })
    successMessage.value = 'Permissions saved'
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : 'Failed to save permissions'
  } finally {
    saving.value = false
  }
}

watch(editorId, () => {
  loadPermissions()
}, { immediate: true })
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Editor Permissions"
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Editors', to: '/admin/editors' },
        { label: editorName || 'Permissions' }
      ]"
      back-to="/admin/editors"
      back-label="Back"
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          <Save class="h-4 w-4" />
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </template>
    </PageHeader>

    <p v-if="loading" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

    <template v-else>
      <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Dashboards</h2>
        <div class="mt-4 grid gap-3">
          <label
            v-for="dashboard in availableDashboards"
            :key="dashboard.id"
            class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="dashboardIds.includes(dashboard.id)"
              @change="toggleId(dashboardIds, dashboard.id)"
            />
            <span>{{ dashboard.name }}</span>
            <span class="text-gray-400">/{{ dashboard.slug }}</span>
          </label>
        </div>
      </section>

      <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Writable Tables</h2>
        <div class="mt-4 grid gap-3">
          <label
            v-for="table in availableWritableTables"
            :key="table.id"
            class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="writableTableIds.includes(table.id)"
              @change="toggleId(writableTableIds, table.id)"
            />
            <span>{{ table.tableName }}</span>
            <span class="text-gray-400">{{ table.dataSourceName }}</span>
          </label>
        </div>
      </section>

      <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>
      <p v-if="successMessage" class="text-sm text-green-600">{{ successMessage }}</p>
    </template>
  </section>
</template>
