import type { Dashboard, DashboardInput, DashboardUpdate } from '~/types/dashboard'

export const useDashboard = () => {
  const apiFetch = process.server ? useRequestFetch() : $fetch

  const list = () =>
    apiFetch<Dashboard[]>('/api/admin/dashboards')

  const getById = (id: string) =>
    apiFetch<Dashboard>(`/api/admin/dashboards/${id}`)

  const create = (payload: DashboardInput) =>
    apiFetch<Dashboard>('/api/admin/dashboards', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: DashboardUpdate) =>
    apiFetch<Dashboard>(`/api/admin/dashboards/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    apiFetch<{ ok: true }>(`/api/admin/dashboards/${id}`, {
      method: 'DELETE'
    })

  const rotateToken = (id: string) =>
    apiFetch<Dashboard>(`/api/admin/dashboards/${id}/rotate-token`, {
      method: 'POST'
    })

  const getPublic = (slug: string, token: string) =>
    apiFetch<{ dashboard: Dashboard; modules: unknown[] }>(
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
