import type { ShareLink, ShareLinkWithStats } from '~/types/share-link'

export const useShareLinks = () => {
  const list = (dashboardId?: string) =>
    $fetch<ShareLinkWithStats[]>('/api/admin/share-links', {
      query: dashboardId ? { dashboardId } : undefined,
      cache: 'no-store'
    })

  const create = (dashboardId: string, label?: string, password?: string) =>
    $fetch<ShareLink>('/api/admin/share-links', {
      method: 'POST',
      body: { dashboardId, label, password }
    })

  const update = (
    id: string,
    payload: {
      label?: string | null
      password?: string | null
    }
  ) =>
    $fetch<ShareLink>(`/api/admin/share-links/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/share-links/${id}`, {
      method: 'DELETE'
    })

  return {
    list,
    create,
    update,
    remove
  }
}
