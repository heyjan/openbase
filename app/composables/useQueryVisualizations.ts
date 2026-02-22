import type {
  QueryVisualization,
  QueryVisualizationInput
} from '~/types/query-visualization'

export const useQueryVisualizations = () => {
  const list = (filters?: { savedQueryId?: string }) =>
    $fetch<QueryVisualization[]>('/api/admin/query-visualizations', {
      query: filters
    })

  const getById = (id: string) =>
    $fetch<QueryVisualization>(`/api/admin/query-visualizations/${id}`)

  const create = (payload: QueryVisualizationInput) =>
    $fetch<QueryVisualization>('/api/admin/query-visualizations', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: Partial<QueryVisualizationInput>) =>
    $fetch<QueryVisualization>(`/api/admin/query-visualizations/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/query-visualizations/${id}`, {
      method: 'DELETE'
    })

  return {
    list,
    getById,
    create,
    update,
    remove
  }
}
