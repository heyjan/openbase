import type {
  DataSource,
  DataSourceInput,
  DataSourceUpdate
} from '~/types/data-source'

export const useDataSources = () => {
  const list = () => $fetch<DataSource[]>('/api/admin/data-sources')

  const getById = (id: string) =>
    $fetch<DataSource>(`/api/admin/data-sources/${id}`)

  const create = (payload: DataSourceInput) =>
    $fetch<DataSource>('/api/admin/data-sources', {
      method: 'POST',
      body: payload
    })

  const update = (id: string, payload: DataSourceUpdate) =>
    $fetch<DataSource>(`/api/admin/data-sources/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/data-sources/${id}`, {
      method: 'DELETE'
    })

  const test = (id: string) =>
    $fetch<{ ok: boolean; tables?: string[] }>(
      `/api/admin/data-sources/${id}/test`,
      { method: 'POST' }
    )

  const listTables = (id: string) =>
    $fetch<string[]>(`/api/admin/data-sources/${id}/tables`)

  const getRows = (id: string, table: string, limit = 50) =>
    $fetch<{ columns: string[]; rows: Record<string, unknown>[] }>(
      `/api/admin/data-sources/${id}/rows`,
      { query: { table, limit } }
    )

  return {
    list,
    getById,
    create,
    update,
    remove,
    test,
    listTables,
    getRows
  }
}
