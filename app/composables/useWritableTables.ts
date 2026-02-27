import type { WritableTable } from '~/types/editor'

export const useWritableTables = () => {
  const list = () => $fetch<WritableTable[]>('/api/admin/writable-tables')

  const create = (payload: {
    dataSourceId: string
    tableName: string
    allowedColumns: string[] | null
    allowInsert: boolean
    allowUpdate: boolean
    description?: string | null
  }) =>
    $fetch<WritableTable>('/api/admin/writable-tables', {
      method: 'POST',
      body: payload
    })

  const update = (
    id: string,
    payload: Partial<{
      dataSourceId: string
      tableName: string
      allowedColumns: string[] | null
      allowInsert: boolean
      allowUpdate: boolean
      description: string | null
    }>
  ) =>
    $fetch<WritableTable>(`/api/admin/writable-tables/${id}`, {
      method: 'PUT',
      body: payload
    })

  const remove = (id: string) =>
    $fetch<{ ok: true }>(`/api/admin/writable-tables/${id}`, {
      method: 'DELETE'
    })

  return {
    list,
    create,
    update,
    remove
  }
}
