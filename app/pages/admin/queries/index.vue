<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import QueryFolderTree from '~/components/admin/QueryFolderTree.vue'
import QueryCard from '~/components/admin/QueryCard.vue'
import type { SavedQuery, QueryFolder } from '~/types/query'

const { list, remove } = useQueries()
const { list: listFolders, create: createFolder, update: updateFolder, remove: removeFolder, assignQuery } = useQueryFolders()
const toast = useAppToast()

const queries = ref<SavedQuery[]>([])
const folders = ref<QueryFolder[]>([])
const loading = ref(false)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)
const selectedFolderId = ref<string | null>(null)

const filteredQueries = computed(() => {
  if (selectedFolderId.value === null) {
    return queries.value
  }
  return queries.value.filter(q => q.folderId === selectedFolderId.value)
})

const selectedFolderName = computed(() => {
  if (selectedFolderId.value === null) return 'All Queries'
  const folder = folders.value.find(f => f.id === selectedFolderId.value)
  return folder?.name ?? 'All Queries'
})

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [q, f] = await Promise.all([list(), listFolders()])
    queries.value = q
    folders.value = f
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load data'
  } finally {
    loading.value = false
  }
}

const deleteQuery = async (queryId: string) => {
  deletingId.value = queryId
  errorMessage.value = ''
  try {
    await remove(queryId)
    queries.value = queries.value.filter(q => q.id !== queryId)
    toast.success('Query deleted')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete query'
    toast.error('Failed to delete query', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

const handleCreateFolder = async (name: string) => {
  try {
    const folder = await createFolder({ name })
    folders.value.push(folder)
    toast.success('Folder created')
  } catch (error) {
    toast.error('Failed to create folder')
  }
}

const handleRenameFolder = async (id: string, name: string) => {
  try {
    const updated = await updateFolder(id, { name })
    const idx = folders.value.findIndex(f => f.id === id)
    if (idx !== -1) folders.value[idx] = updated
  } catch (error) {
    toast.error('Failed to rename folder')
  }
}

const handleDeleteFolder = async (id: string) => {
  try {
    await removeFolder(id)
    folders.value = folders.value.filter(f => f.id !== id)
    // Unassign queries that were in this folder (locally)
    queries.value.forEach(q => {
      if (q.folderId === id) q.folderId = null
    })
    if (selectedFolderId.value === id) {
      selectedFolderId.value = null
    }
    toast.success('Folder deleted')
  } catch (error) {
    toast.error('Failed to delete folder')
  }
}

const handleDrop = async (queryId: string, folderId: string | null) => {
  const query = queries.value.find(q => q.id === queryId)
  if (!query || query.folderId === folderId) return

  const previousFolderId = query.folderId
  // Optimistic update
  query.folderId = folderId

  try {
    await assignQuery(queryId, folderId)
  } catch (error) {
    // Revert on failure
    query.folderId = previousFolderId
    toast.error('Failed to move query')
  }
}

onMounted(loadData)
</script>

<template>
  <section class="flex h-full px-6 py-5">
    <!-- Folder sidebar -->
    <aside class="w-56 shrink-0 border-r border-gray-200 pr-4">
      <QueryFolderTree
        :folders="folders"
        :selected-folder-id="selectedFolderId"
        @select="selectedFolderId = $event"
        @drop="handleDrop"
        @create="handleCreateFolder"
        @rename="handleRenameFolder"
        @delete="handleDeleteFolder"
      />
    </aside>

    <!-- Main content -->
    <div class="min-w-0 flex-1 pl-6">
      <PageHeader
        :title="selectedFolderName"
        description="Reusable queries that power dashboard modules."
        :breadcrumbs="[
          { label: 'Dashboards', to: '/admin' },
          { label: 'Queries' }
        ]"
        back-to="/admin"
        back-label="Back to dashboards"
      >
        <template #actions>
          <NuxtLink
            to="/admin/queries/new"
            class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Plus class="h-4 w-4" />
            New query
          </NuxtLink>
        </template>
      </PageHeader>

      <div class="mt-4">
        <p v-if="loading" class="text-sm text-gray-500">Loading queries...</p>
        <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
        <p v-else-if="!filteredQueries.length" class="text-sm text-gray-500">
          {{ selectedFolderId ? 'No queries in this folder.' : 'No saved queries yet.' }}
        </p>

        <div
          v-else
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <QueryCard
            v-for="q in filteredQueries"
            :key="q.id"
            :query="q"
            @delete="deleteQuery"
          />
        </div>
      </div>
    </div>
  </section>
</template>
