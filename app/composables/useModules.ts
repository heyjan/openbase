import type {
  ModuleConfig,
  ModuleInput,
  ModuleLayoutUpdate,
  ModuleUpdate
} from '~/types/module'

export const useModules = () => {
  const list = (dashboardId: string) =>
    $fetch<ModuleConfig[]>(`/api/admin/dashboards/${dashboardId}/modules`)

  const create = (dashboardId: string, payload: ModuleInput) =>
    $fetch<ModuleConfig>(`/api/admin/dashboards/${dashboardId}/modules`, {
      method: 'POST',
      body: payload
    })

  const update = (moduleId: string, payload: ModuleUpdate) =>
    $fetch<ModuleConfig>(`/api/admin/modules/${moduleId}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (moduleId: string) =>
    $fetch<{ ok: true }>(`/api/admin/modules/${moduleId}`, {
      method: 'DELETE'
    })

  const updateLayout = (dashboardId: string, layout: ModuleLayoutUpdate[]) =>
    $fetch<ModuleConfig[]>(`/api/admin/dashboards/${dashboardId}/modules/layout`, {
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
