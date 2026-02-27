<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { SavedQuery } from '~/types/query'

const { list, remove } = useQueries()

const queries = ref<SavedQuery[]>([])
const loading = ref(false)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)

const loadQueries = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    queries.value = await list()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load saved queries'
  } finally {
    loading.value = false
  }
}

const deleteQuery = async (queryId: string) => {
  deletingId.value = queryId
  errorMessage.value = ''
  try {
    await remove(queryId)
    await loadQueries()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete query'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadQueries)
</script>

<template>
  <section class="px-6 py-5">
    <PageHeader
      title="Saved Queries"
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

    <div class="mt-6 space-y-3">
      <p v-if="loading" class="text-sm text-gray-500">Loading queries…</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <p v-else-if="!queries.length" class="text-sm text-gray-500">
        No saved queries yet.
      </p>

      <div
        v-else
        v-for="query in queries"
        :key="query.id"
        class="rounded border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ query.name }}</h2>
            <p class="text-xs text-gray-500">
              {{ query.dataSourceName || query.dataSourceId }}
            </p>
            <p v-if="query.description" class="mt-2 text-sm text-gray-600">
              {{ query.description }}
            </p>
            <p class="mt-2 text-xs text-gray-500">Updated: {{ query.updatedAt }}</p>
          </div>
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/admin/queries/${query.id}`"
              class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300"
            >
              Edit
            </NuxtLink>
            <button
              class="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-300 disabled:opacity-50"
              :disabled="deletingId === query.id"
              @click="deleteQuery(query.id)"
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
