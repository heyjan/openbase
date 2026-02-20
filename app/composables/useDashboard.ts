import type { Dashboard, DashboardInput, DashboardUpdate } from '~/types/dashboard'

export const useDashboard = () => {
  const list = () =>
    $fetch<Dashboard[]>('/api/admin/dashboards')

  const getById = (id: string) =>
    $fetch<Dashboard>(`/api/admin/dashboards/${id}`)

  const create = (payload: DashboardInput) =>
    $fetch<Dashboard>('/api/admin/dashboards', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: DashboardUpdate) =>
    $fetch<Dashboard>(`/api/admin/dashboards/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/dashboards/${id}`, {
      method: 'DELETE'
    })

  const rotateToken = (id: string) =>
    $fetch<Dashboard>(`/api/admin/dashboards/${id}/rotate-token`, {
      method: 'POST'
    })

  const getPublic = (slug: string, token: string) =>
    $fetch<{ dashboard: Dashboard; modules: unknown[] }>(
      `/api/dashboards/${slug}`,
      {
        query: { token }
      }
    )

  return {
    list,
    getById,
    create,
    update,
    remove,
    rotateToken,
    getPublic
  }
}
