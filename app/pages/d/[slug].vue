<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import DashboardFilterBar from '~/components/dashboard/DashboardFilterBar.vue'
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import { useExportPdf } from '~/composables/useExportPdf'
import type { QueryVariable } from '~/types/query-variable'

definePageMeta({
  ssr: false
})

const route = useRoute()
const { getPublic } = useDashboard()

const slug = computed(() => String(route.params.slug || ''))
const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const asyncKey = computed(() => `public-dashboard-${slug.value}-${token.value || 'missing-token'}`)
const tokenMissing = computed(() => !token.value)
const gridRef = ref<HTMLElement | null>(null)

const { data: response, pending, error } = useAsyncData(
  asyncKey,
  () => (token.value ? getPublic(slug.value, token.value) : null),
  {
    watch: [slug, token],
    getCachedData: () => undefined
  }
)

const canvasWidthMode = computed(() =>
  response.value?.dashboard?.gridConfig?.canvasWidthMode === 'full' ? 'full' : 'fixed'
)

const dashboard = computed(() => {
  if (!response.value?.dashboard) {
    return null
  }

  return {
    name: response.value.dashboard.name,
    slug: response.value.dashboard.slug
  }
})

const routeQuery = computed<Record<string, string>>(() => {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        next[key] = value[0]
      }
      continue
    }
    if (typeof value === 'string') {
      next[key] = value
      continue
    }
    if (typeof value === 'number') {
      next[key] = String(value)
    }
  }
  return next
})

const sharedVariables = ref<QueryVariable[]>([])
const sharedVariablesLoading = ref(false)
const sharedVariableError = ref('')

const { currentValues, updateValue, resetToDefaults } = useVariableSelectors({
  mode: 'shared',
  variables: sharedVariables,
  routeQuery
})

const mergeOptions = (
  existing: QueryVariable['options'],
  incoming: QueryVariable['options']
) => {
  const next = [...existing]
  const existingValues = new Set(existing.map((option) => option.value))

  for (const option of incoming) {
    if (!existingValues.has(option.value)) {
      next.push(option)
      existingValues.add(option.value)
    }
  }

  return next
}

const loadSharedVariables = async () => {
  sharedVariableError.value = ''

  const publicDashboard = response.value
  if (!publicDashboard || !slug.value || !token.value) {
    sharedVariables.value = []
    return
  }

  const modules = publicDashboard.modules ?? []
  const moduleIds = modules
    .map((module) => module.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (!moduleIds.length) {
    sharedVariables.value = []
    return
  }

  sharedVariablesLoading.value = true

  try {
    const responses = await Promise.all(
      moduleIds.map((moduleId) =>
        $fetch<{ variables: QueryVariable[] }>(
          `/api/dashboards/${slug.value}/modules/${moduleId}/variables`,
          {
            query: {
              token: token.value
            }
          }
        ).catch(() => ({ variables: [] as QueryVariable[] }))
      )
    )

    const merged = new Map<string, QueryVariable>()

    for (const payload of responses) {
      for (const variable of payload.variables ?? []) {
        const existing = merged.get(variable.name)
        if (!existing) {
          merged.set(variable.name, {
            ...variable,
            options: [...(variable.options ?? [])]
          })
          continue
        }

        merged.set(variable.name, {
          ...existing,
          options: mergeOptions(existing.options, variable.options ?? [])
        })
      }
    }

    sharedVariables.value = Array.from(merged.values())
    resetToDefaults()
  } catch (error) {
    sharedVariableError.value =
      error instanceof Error ? error.message : 'Failed to load variable options'
    sharedVariables.value = []
  } finally {
    sharedVariablesLoading.value = false
  }
}

watch(
  () => [response.value?.dashboard?.id, slug.value, token.value],
  () => {
    loadSharedVariables()
  },
  { immediate: true }
)

const onFilterChange = (payload: { name: string; value: string }) => {
  updateValue(payload.name, payload.value)
}

const { exporting, exportPdf } = useExportPdf({
  gridRef,
  dashboard
})
</script>

<template>
  <section
    class="mx-auto px-6 py-10"
    :class="canvasWidthMode === 'fixed' ? 'max-w-[1240px]' : 'max-w-none'"
  >
    <p v-if="tokenMissing" class="text-sm text-red-600">Missing share token.</p>
    <p v-else-if="pending" class="text-sm text-gray-500">Loading dashboard...</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error?.message || 'Unable to load dashboard.' }}
    </p>

    <div v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ response?.dashboard.name }}</h1>
        <button
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="exporting || !response?.modules?.length"
          @click="exportPdf"
        >
          <Download class="h-4 w-4" />
          {{ exporting ? 'Exporting...' : 'Export PDF' }}
        </button>
      </div>

      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>

      <p v-if="sharedVariablesLoading" class="mt-4 text-xs text-gray-500">
        Loading variable options...
      </p>
      <p v-else-if="sharedVariableError" class="mt-4 text-sm text-red-600">
        {{ sharedVariableError }}
      </p>
      <DashboardFilterBar
        v-else
        class="mt-4"
        mode="shared"
        :variables="sharedVariables"
        :values="currentValues"
        @change="onFilterChange"
      />

      <div ref="gridRef" class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules yet.</p>
      </div>
    </div>
  </section>
</template>
