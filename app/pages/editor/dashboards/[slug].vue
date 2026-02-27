<script setup lang="ts">
import DashboardFilterBar from '~/components/dashboard/DashboardFilterBar.vue'
import DashboardGrid from '~/components/dashboard/DashboardGrid.vue'
import type { QueryVariable } from '~/types/query-variable'

definePageMeta({
  layout: 'editor',
  ssr: false
})

const route = useRoute()
const { getBySlug, getModuleVariables } = useEditorDashboards()

const slug = computed(() => String(route.params.slug || ''))
const asyncKey = computed(() => `editor-dashboard-${slug.value}`)

const { data: response, pending, error } = useAsyncData(
  asyncKey,
  () => getBySlug(slug.value),
  {
    watch: [slug],
    getCachedData: () => undefined
  }
)

const canvasWidthMode = computed(() =>
  response.value?.dashboard?.gridConfig?.canvasWidthMode === 'full' ? 'full' : 'fixed'
)

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

const variables = ref<QueryVariable[]>([])
const variablesLoading = ref(false)
const variableError = ref('')

const { currentValues, updateValue, resetToDefaults } = useVariableSelectors({
  mode: 'shared',
  variables,
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

const loadVariables = async () => {
  variableError.value = ''

  const dashboard = response.value
  if (!dashboard) {
    variables.value = []
    return
  }

  const moduleIds = (dashboard.modules ?? [])
    .map((module) => module.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (!moduleIds.length) {
    variables.value = []
    return
  }

  variablesLoading.value = true

  try {
    const responses = await Promise.all(
      moduleIds.map((moduleId) =>
        getModuleVariables(slug.value, moduleId).catch(() => ({ variables: [] as QueryVariable[] }))
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

    variables.value = Array.from(merged.values())
    resetToDefaults()
  } catch (error) {
    variableError.value =
      error instanceof Error ? error.message : 'Failed to load variable options'
    variables.value = []
  } finally {
    variablesLoading.value = false
  }
}

watch(
  () => [response.value?.dashboard?.id, slug.value],
  () => {
    loadVariables()
  },
  { immediate: true }
)

const onFilterChange = (payload: { name: string; value: string }) => {
  updateValue(payload.name, payload.value)
}
</script>

<template>
  <section
    class="mx-auto"
    :style="{ maxWidth: canvasWidthMode === 'fixed' ? '1240px' : 'none' }"
  >
    <p v-if="pending" class="text-sm text-gray-500">Loading...</p>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error?.message || 'Failed to load dashboard.' }}
    </p>

    <template v-else>
      <h1 class="text-2xl font-semibold text-gray-900">{{ response?.dashboard.name }}</h1>
      <p v-if="response?.dashboard.description" class="mt-2 text-sm text-gray-600">
        {{ response.dashboard.description }}
      </p>

      <p v-if="variablesLoading" class="mt-4 text-xs text-gray-500">Loading filters...</p>
      <p v-else-if="variableError" class="mt-4 text-sm text-red-600">{{ variableError }}</p>

      <DashboardFilterBar
        v-else
        class="mt-4"
        mode="shared"
        :variables="variables"
        :values="currentValues"
        @change="onFilterChange"
      />

      <div class="mt-6">
        <DashboardGrid v-if="response?.modules?.length" :modules="response.modules" />
        <p v-else class="text-sm text-gray-500">No modules.</p>
      </div>
    </template>
  </section>
</template>
