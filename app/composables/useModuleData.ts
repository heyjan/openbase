import type { Ref } from 'vue'
import { isTextModuleType, type ModuleConfig } from '~/types/module'

export type ModuleDataResult = {
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
}

const emptyModuleData = (): ModuleDataResult => ({
  rows: [],
  columns: [],
  rowCount: 0
})

const getSavedQueryId = (module: ModuleConfig) => {
  return module.queryVisualizationQueryId?.trim() ?? ''
}

export const useModuleData = (moduleRef: Ref<ModuleConfig>) => {
  const fallbackRoute = reactive({
    params: {} as Record<string, unknown>,
    query: {} as Record<string, unknown>,
    path: '',
    fullPath: ''
  })

  let route: ReturnType<typeof useRoute>
  try {
    route = useRoute()
  } catch {
    route = fallbackRoute as ReturnType<typeof useRoute>
  }

  const publicSlug = computed(() =>
    typeof route.params.slug === 'string' ? route.params.slug : ''
  )
  const dashboardId = computed(() =>
    typeof route.params.id === 'string' ? route.params.id : ''
  )
  const token = computed(() =>
    typeof route.query.token === 'string' ? route.query.token : ''
  )
  const adminDashboardVariableValues = useState<Record<string, string>>(
    'admin-dashboard-variable-values',
    () => ({})
  )
  const adminDashboardVariableValuesKey = computed(() =>
    Object.entries(adminDashboardVariableValues.value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')
  )
  const savedQueryId = computed(() => getSavedQueryId(moduleRef.value))
  const isPublicDashboardRoute = computed(() =>
    route.path.startsWith('/d/') && !!publicSlug.value
  )
  const isEditorDashboardRoute = computed(() =>
    route.path.startsWith('/editor/dashboards/') && !!publicSlug.value
  )
  const isAdminDashboardEditRoute = computed(() =>
    route.path.startsWith('/admin/dashboards/') &&
    route.path.endsWith('/edit') &&
    !!dashboardId.value
  )

  const canFetch = computed(() => {
    if (isTextModuleType(moduleRef.value.type)) {
      return false
    }
    if (!savedQueryId.value) {
      return false
    }
    if (isPublicDashboardRoute.value) {
      return !!token.value
    }
    if (isEditorDashboardRoute.value) {
      return true
    }
    if (isAdminDashboardEditRoute.value) {
      return true
    }
    return false
  })

  const endpoint = computed(() => {
    if (isPublicDashboardRoute.value) {
      return `/api/dashboards/${publicSlug.value}/modules/${moduleRef.value.id}/data`
    }
    if (isEditorDashboardRoute.value) {
      return `/api/editor/dashboards/${publicSlug.value}/modules/${moduleRef.value.id}/data`
    }
    if (isAdminDashboardEditRoute.value) {
      return `/api/admin/dashboards/${dashboardId.value}/modules/${moduleRef.value.id}/data`
    }
    return ''
  })

  const queryParams = computed<Record<string, unknown>>(() => {
    const params: Record<string, unknown> = {}

    if (isPublicDashboardRoute.value) {
      for (const [key, value] of Object.entries(route.query)) {
        if (value === undefined || value === null) {
          continue
        }
        params[key] = value
      }
      params.token = token.value
      return params
    }

    if (isEditorDashboardRoute.value) {
      for (const [key, value] of Object.entries(route.query)) {
        if (value === undefined || value === null) {
          continue
        }
        params[key] = value
      }
      return params
    }

    if (isAdminDashboardEditRoute.value) {
      for (const [key, value] of Object.entries(adminDashboardVariableValues.value)) {
        if (!value) {
          continue
        }
        params[key] = value
      }
    }

    return params
  })

  const data = ref<ModuleDataResult>(emptyModuleData())
  const pending = ref(false)
  const errorMessage = ref('')
  let requestSeq = 0

  const refresh = async () => {
    const requestId = ++requestSeq

    if (!canFetch.value || !endpoint.value) {
      data.value = emptyModuleData()
      pending.value = false
      errorMessage.value = ''
      return
    }

    pending.value = true
    errorMessage.value = ''

    try {
      const response = await $fetch<ModuleDataResult>(endpoint.value, {
        query: queryParams.value
      })

      if (requestId !== requestSeq) {
        return
      }

      data.value = response
    } catch (error) {
      if (requestId !== requestSeq) {
        return
      }

      errorMessage.value =
        error instanceof Error ? error.message : 'Failed to load module data'
      data.value = emptyModuleData()
    } finally {
      if (requestId === requestSeq) {
        pending.value = false
      }
    }
  }

  watch(
    [
      () => moduleRef.value.id,
      () => moduleRef.value.type,
      () => savedQueryId.value,
      () => publicSlug.value,
      () => dashboardId.value,
      () => token.value,
      () => adminDashboardVariableValuesKey.value,
      () => route.path,
      () => route.fullPath
    ],
    () => {
      refresh()
    },
    { immediate: true }
  )

  return {
    data,
    pending,
    error: computed(() => errorMessage.value),
    refresh,
    canFetch
  }
}
