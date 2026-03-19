import type { VisualizationFolder } from '~/types/visualization-folder'

export const useVisualizationFolders = () => {
  const list = () => $fetch<VisualizationFolder[]>('/api/admin/visualization-folders')

  const create = (payload: { name: string }) =>
    $fetch<VisualizationFolder>('/api/admin/visualization-folders', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: Partial<{ name: string }>) =>
    $fetch<VisualizationFolder>(`/api/admin/visualization-folders/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/visualization-folders/${id}`, {
      method: 'DELETE'
    })

  const assignVisualization = (visualizationId: string, folderId: string | null) =>
    $fetch<{ ok: true }>(`/api/admin/query-visualizations/${visualizationId}/folder`, {
      method: 'PUT',
      body: { folderId }
    })

  return { list, create, update, remove, assignVisualization }
}
