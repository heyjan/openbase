<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { QueryVisualization } from '~/types/query-visualization'

const { list, remove } = useQueryVisualizations()
const toast = useAppToast()

const visualizations = ref<QueryVisualization[]>([])
const loading = ref(false)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)

const loadVisualizations = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    visualizations.value = await list()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load visualizations'
  } finally {
    loading.value = false
  }
}

const deleteVisualization = async (id: string) => {
  deletingId.value = id
  errorMessage.value = ''

  try {
    await remove(id)
    await loadVisualizations()
    toast.success('Visualization deleted')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to delete visualization'
    toast.error('Failed to delete visualization', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

onMounted(loadVisualizations)
</script>

<template>
  <section class="px-6 py-10">
    <PageHeader
      title="Query Visualizations"
      description="Saved visualization presets linked to queries."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Visualizations' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <div class="mt-6 space-y-3">
      <p v-if="loading" class="text-sm text-gray-500">Loading visualizations…</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <p v-else-if="!visualizations.length" class="text-sm text-gray-500">
        No saved visualizations yet.
      </p>

      <div
        v-else
        v-for="visualization in visualizations"
        :key="visualization.id"
        class="rounded border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ visualization.name }}</h2>
            <p class="text-xs text-gray-500">
              {{ visualization.moduleType.replace(/_/g, ' ') }} • Query: {{ visualization.savedQueryName }}
            </p>
            <p class="mt-2 text-xs text-gray-500">Updated: {{ visualization.updatedAt }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              :to="`/admin/queries/${visualization.savedQueryId}`"
              color="neutral"
              variant="outline"
              size="sm"
            >
              Open query
            </UButton>
            <UButton
              color="error"
              variant="outline"
              size="sm"
              class="inline-flex items-center gap-1"
              :disabled="deletingId === visualization.id"
              @click="deleteVisualization(visualization.id)"
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
