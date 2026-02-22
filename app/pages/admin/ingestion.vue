<script setup lang="ts">
import { Play, RefreshCw } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type {
  IngestionPipeline,
  IngestionPipelineStatus,
  IngestionRun
} from '~/types/ingestion'

const { getStatus, trigger } = useIngestion()
const toast = useAppToast()

const pipelines = ref<IngestionPipeline[]>([])
const recentRuns = ref<IngestionRun[]>([])
const loading = ref(false)
const errorMessage = ref('')
const triggeringPipelineId = ref<string | null>(null)

const statusClasses: Record<IngestionPipelineStatus, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  empty: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700'
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Never'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const formatStatus = (status: string) =>
  status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatDuration = (run: IngestionRun) => {
  if (!run.finishedAt) {
    return 'In progress'
  }

  const startedAt = new Date(run.startedAt)
  const finishedAt = new Date(run.finishedAt)
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
    return '-'
  }

  const seconds = Math.max(1, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))
  return `${seconds}s`
}

const loadStatus = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await getStatus()
    pipelines.value = result.pipelines
    recentRuns.value = result.recentRuns
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load ingestion status'
    toast.error('Failed to load ingestion status', errorMessage.value)
  } finally {
    loading.value = false
  }
}

const triggerPipeline = async (pipelineId: string) => {
  triggeringPipelineId.value = pipelineId
  errorMessage.value = ''

  try {
    await trigger(pipelineId)
    await loadStatus()
    toast.success('Pipeline trigger sent')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to trigger pipeline'
    toast.error('Failed to trigger pipeline', errorMessage.value)
  } finally {
    triggeringPipelineId.value = null
  }
}

onMounted(loadStatus)
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <PageHeader
      title="Ingestion Status"
      description="Monitor pipeline health, recent runs, and trigger manual updates."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Ingestion' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    >
      <template #actions>
        <button
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
          :disabled="loading"
          @click="loadStatus"
        >
          <RefreshCw class="h-4 w-4" />
          Refresh
        </button>
      </template>
    </PageHeader>

    <p v-if="loading" class="mt-6 text-sm text-gray-500">Loading pipeline status…</p>
    <p v-else-if="errorMessage" class="mt-6 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-else class="mt-6 space-y-8">
      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="pipeline in pipelines"
          :key="pipeline.id"
          class="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-gray-900">{{ pipeline.label }}</h2>
              <p class="mt-1 text-xs text-gray-500">{{ pipeline.description }}</p>
            </div>
            <span
              class="rounded-full px-2 py-1 text-xs font-medium"
              :class="statusClasses[pipeline.status]"
            >
              {{ formatStatus(pipeline.status) }}
            </span>
          </div>

          <dl class="mt-4 space-y-1 text-sm text-gray-700">
            <div class="flex items-center justify-between gap-2">
              <dt>Rows</dt>
              <dd>{{ pipeline.rowCount }}</dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt>Latest data</dt>
              <dd>{{ formatDateTime(pipeline.lastDataAt) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt>Latest run</dt>
              <dd>{{ formatDateTime(pipeline.lastRunAt) }}</dd>
            </div>
          </dl>

          <p v-if="pipeline.lastMessage" class="mt-3 text-xs text-gray-500">
            {{ pipeline.lastMessage }}
          </p>

          <button
            class="mt-4 inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
            :disabled="triggeringPipelineId === pipeline.id"
            @click="triggerPipeline(pipeline.id)"
          >
            <Play class="h-4 w-4" />
            {{ triggeringPipelineId === pipeline.id ? 'Triggering...' : 'Trigger pipeline' }}
          </button>
        </div>
      </div>

      <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Recent Runs</h2>
        <p class="mt-1 text-sm text-gray-500">
          Last 25 manual pipeline triggers and outcomes.
        </p>

        <p v-if="!recentRuns.length" class="mt-4 text-sm text-gray-500">No runs yet.</p>

        <div v-else class="mt-4 overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th class="px-3 py-2">Pipeline</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Started</th>
                <th class="px-3 py-2">Duration</th>
                <th class="px-3 py-2">Rows</th>
                <th class="px-3 py-2">Triggered By</th>
                <th class="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in recentRuns" :key="run.id" class="border-b border-gray-100">
                <td class="px-3 py-2">{{ run.pipeline }}</td>
                <td class="px-3 py-2">{{ formatStatus(run.status) }}</td>
                <td class="px-3 py-2">{{ formatDateTime(run.startedAt) }}</td>
                <td class="px-3 py-2">{{ formatDuration(run) }}</td>
                <td class="px-3 py-2">{{ run.rowCount ?? '-' }}</td>
                <td class="px-3 py-2">{{ run.triggeredBy || '-' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ run.message || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
