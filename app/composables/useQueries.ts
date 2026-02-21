import type {
  SavedQuery,
  SavedQueryInput,
  SavedQueryPreviewResult
} from '~/types/query'

export const useQueries = () => {
  const list = () => $fetch<SavedQuery[]>('/api/admin/queries')

  const getById = (id: string) => $fetch<SavedQuery>(`/api/admin/queries/${id}`)

  const create = (payload: SavedQueryInput) =>
    $fetch<SavedQuery>('/api/admin/queries', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: Partial<SavedQueryInput>) =>
    $fetch<SavedQuery>(`/api/admin/queries/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/queries/${id}`, {
      method: 'DELETE'
    })

  const preview = (
    id: string,
    payload: { parameters?: Record<string, unknown>; limit?: number }
  ) =>
    $fetch<SavedQueryPreviewResult>(`/api/admin/queries/${id}/preview`, {
      method: 'POST',
      body: payload
    })

  return {
    list,
    getById,
    create,
    update,
    remove,
    preview
  }
}
