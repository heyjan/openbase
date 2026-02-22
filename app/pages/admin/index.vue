<script setup lang="ts">
import {
  Database,
  LayoutDashboard,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Shield
} from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { Dashboard } from '~/types/dashboard'

const { list, remove } = useDashboard()
const toast = useAppToast()

const { data: dashboards, pending, error, refresh } = useAsyncData(
  'admin-dashboards',
  list,
  { server: false }
)

const deleting = ref<string | null>(null)
const deleteError = ref('')
const confirmDeleteOpen = ref(false)
const pendingDeleteDashboard = ref<Dashboard | null>(null)

const openDeleteConfirm = (dashboard: Dashboard) => {
  pendingDeleteDashboard.value = dashboard
  confirmDeleteOpen.value = true
}

const deleteDashboard = async () => {
  if (!pendingDeleteDashboard.value) {
    return
  }

  const id = pendingDeleteDashboard.value.id
  deleteError.value = ''
  deleting.value = id
  try {
    await remove(id)
    await refresh()
    confirmDeleteOpen.value = false
    pendingDeleteDashboard.value = null
    toast.success('Dashboard deleted')
  } catch (err) {
    deleteError.value =
      err instanceof Error ? err.message : 'Unable to delete dashboard'
    toast.error('Unable to delete dashboard', deleteError.value)
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Admin"
      description="Manage dashboards and share links."
      :breadcrumbs="[{ label: 'Dashboards' }]"
    >
      <template #actions>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/data-sources"
        >
          <Database class="h-4 w-4" />
          Data sources
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/admins"
        >
          <Shield class="h-4 w-4" />
          Manage admins
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/queries"
        >
          <Search class="h-4 w-4" />
          Saved queries
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/visualizations"
        >
          <LayoutDashboard class="h-4 w-4" />
          Visualizations
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/ingestion"
        >
          <RefreshCw class="h-4 w-4" />
          Ingestion
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300"
          to="/admin/share-links"
        >
          <Link2 class="h-4 w-4" />
          Share links
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          to="/admin/dashboards/new"
        >
          <Plus class="h-4 w-4" />
          New dashboard
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="mt-6 space-y-4">
      <p v-if="pending" class="text-sm text-gray-500">Loading dashboards…</p>
      <p v-else-if="error" class="text-sm text-red-600">
        {{ error?.message || 'Failed to load dashboards.' }}
      </p>
      <p v-else-if="!dashboards?.length" class="text-sm text-gray-500">
        No dashboards yet.
      </p>

      <div v-else class="space-y-3">
        <div
          v-for="dashboard in dashboards"
          :key="dashboard.id"
          class="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="rounded bg-gray-100 p-2 text-gray-600">
                <LayoutDashboard class="h-4 w-4" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">{{ dashboard.name }}</h2>
                <p class="text-xs text-gray-500">/{{ dashboard.slug }}</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <NuxtLink
                class="rounded border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300"
                :to="`/admin/dashboards/${dashboard.id}/edit`"
              >
                Edit
              </NuxtLink>
              <NuxtLink
                class="rounded border border-gray-200 px-3 py-1.5 text-gray-700 hover:border-gray-300"
                :to="`/admin/dashboards/${dashboard.id}/share`"
              >
                Share
              </NuxtLink>
              <button
                class="rounded border border-red-200 px-3 py-1.5 text-red-700 hover:border-red-300"
                :disabled="deleting === dashboard.id"
                @click="openDeleteConfirm(dashboard)"
              >
                Delete
              </button>
            </div>
          </div>
          <p v-if="dashboard.description" class="mt-2 text-sm text-gray-600">
            {{ dashboard.description }}
          </p>
        </div>
      </div>

      <p v-if="deleteError" class="text-sm text-red-600">
        {{ deleteError }}
      </p>
    </div>

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete dashboard?"
      :message="pendingDeleteDashboard ? `This permanently removes '${pendingDeleteDashboard.name}' and all modules.` : 'This permanently removes the selected dashboard.'"
      confirm-label="Delete dashboard"
      confirm-tone="danger"
      :pending="pendingDeleteDashboard ? deleting === pendingDeleteDashboard.id : false"
      @confirm="deleteDashboard"
    />
  </section>
</template>
