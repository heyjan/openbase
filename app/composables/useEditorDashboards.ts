import type { Dashboard } from '~/types/dashboard'
import type { ModuleConfig } from '~/types/module'
import type { QueryVariable } from '~/types/query-variable'

export const useEditorDashboards = () => {
  const list = () => $fetch<Dashboard[]>('/api/editor/dashboards')

  const getBySlug = (slug: string) =>
    $fetch<{ dashboard: Dashboard; modules: ModuleConfig[] }>(`/api/editor/dashboards/${slug}`)

  const getModuleData = (
    slug: string,
    moduleId: string,
    query?: Record<string, string>
  ) =>
    $fetch<{ rows: Record<string, unknown>[]; columns: string[]; rowCount: number }>(
      `/api/editor/dashboards/${slug}/modules/${moduleId}/data`,
      { query }
    )

  const getModuleVariables = (slug: string, moduleId: string) =>
    $fetch<{ variables: QueryVariable[] }>(
      `/api/editor/dashboards/${slug}/modules/${moduleId}/variables`
    )

  return {
    list,
    getBySlug,
    getModuleData,
    getModuleVariables
  }
}
