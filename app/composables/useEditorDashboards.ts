import type { Dashboard } from '~/types/dashboard'
import type { ModuleConfig } from '~/types/module'
import type { QueryVariable } from '~/types/query-variable'

export const useEditorDashboards = () => {
  const requestFetch = process.server ? useRequestFetch() : $fetch
  const baseRequestOptions = process.server ? {} : ({ credentials: 'include' as const })

  const list = () =>
    requestFetch<Dashboard[]>('/api/editor/dashboards', baseRequestOptions)

  const getBySlug = (slug: string) =>
    requestFetch<{ dashboard: Dashboard; modules: ModuleConfig[] }>(
      `/api/editor/dashboards/${slug}`,
      baseRequestOptions
    )

  const getModuleData = (
    slug: string,
    moduleId: string,
    query?: Record<string, string>
  ) =>
    requestFetch<{ rows: Record<string, unknown>[]; columns: string[]; rowCount: number }>(
      `/api/editor/dashboards/${slug}/modules/${moduleId}/data`,
      { ...baseRequestOptions, query }
    )

  const getModuleVariables = (slug: string, moduleId: string) =>
    requestFetch<{ variables: QueryVariable[] }>(
      `/api/editor/dashboards/${slug}/modules/${moduleId}/variables`,
      baseRequestOptions
    )

  return {
    list,
    getBySlug,
    getModuleData,
    getModuleVariables
  }
}
