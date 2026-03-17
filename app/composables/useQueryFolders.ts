import type { QueryFolder } from '~/types/query'

export const useQueryFolders = () => {
  const list = () => $fetch<QueryFolder[]>('/api/admin/query-folders')

  const create = (payload: { name: string }) =>
    $fetch<QueryFolder>('/api/admin/query-folders', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: Partial<{ name: string; sortOrder: number }>) =>
    $fetch<QueryFolder>(`/api/admin/query-folders/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/query-folders/${id}`, {
      method: 'DELETE'
    })

  const assignQuery = (queryId: string, folderId: string | null) =>
    $fetch<{ ok: true }>(`/api/admin/queries/${queryId}/folder`, {
      method: 'PUT',
      body: { folderId }
    })

  return { list, create, update, remove, assignQuery }
}
