import type { Ref } from 'vue'
import type { ModuleConfig } from '~/types/module'

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
  const raw =
    module.config.saved_query_id ?? module.config.savedQueryId
  return typeof raw === 'string' ? raw.trim() : ''
}

export const useModuleData = (moduleRef: Ref<ModuleConfig>) => {
  const route = useRoute()

  const slug = computed(() =>
    typeof route.params.slug === 'string' ? route.params.slug : ''
  )
  const token = computed(() =>
    typeof route.query.token === 'string' ? route.query.token : ''
  )
  const savedQueryId = computed(() => getSavedQueryId(moduleRef.value))

  const canFetch = computed(() => {
    return (
      route.path.startsWith('/d/') &&
      !!slug.value &&
      !!token.value &&
      !!savedQueryId.value
    )
  })

  const queryParams = computed<Record<string, unknown>>(() => {
    const params: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (value === undefined || value === null) {
        continue
      }
      params[key] = value
    }
    params.token = token.value
    return params
  })

  const { data, pending, error, refresh } = useAsyncData<ModuleDataResult>(
    async () => {
      if (!canFetch.value) {
        return emptyModuleData()
      }
      return await $fetch<ModuleDataResult>(
        `/api/dashboards/${slug.value}/modules/${moduleRef.value.id}/data`,
        { query: queryParams.value }
      )
    },
    {
      server: false,
      default: emptyModuleData,
      watch: [
        () => moduleRef.value.id,
        () => savedQueryId.value,
        () => slug.value,
        () => token.value,
        () => route.fullPath
      ]
    }
  )

  const errorMessage = computed(() => {
    if (!error.value) {
      return ''
    }
    return error.value instanceof Error
      ? error.value.message
      : 'Failed to load module data'
  })

  return {
    data,
    pending,
    error: errorMessage,
    refresh,
    canFetch
  }
}
