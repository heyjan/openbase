import type {
  ModuleConfig,
  ModuleInput,
  ModuleLayoutUpdate,
  ModuleUpdate
} from '~/types/module'

export const useModules = () => {
  const apiFetch = process.server ? useRequestFetch() : $fetch

  const list = (dashboardId: string) =>
    apiFetch<ModuleConfig[]>(`/api/admin/dashboards/${dashboardId}/modules`)

  const create = (dashboardId: string, payload: ModuleInput) =>
    apiFetch<ModuleConfig>(`/api/admin/dashboards/${dashboardId}/modules`, {
      method: 'POST',
      body: payload
    })

  const update = (moduleId: string, payload: ModuleUpdate) =>
    apiFetch<ModuleConfig>(`/api/admin/modules/${moduleId}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (moduleId: string) =>
    apiFetch<{ ok: true }>(`/api/admin/modules/${moduleId}`, {
      method: 'DELETE'
    })

  const updateLayout = (dashboardId: string, layout: ModuleLayoutUpdate[]) =>
    apiFetch<ModuleConfig[]>(`/api/admin/dashboards/${dashboardId}/modules/layout`, {
      method: 'PUT',
      body: layout
    })

  return {
    list,
    create,
    update,
    remove,
    updateLayout
  }
}
