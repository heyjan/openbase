import type { TableColumnSchema, WritableTable } from '~/types/editor'

export const useEditorDataEntry = () => {
  const listWritableTables = () => $fetch<WritableTable[]>('/api/editor/writable-tables')

  const getSchema = (id: string) =>
    $fetch<{ table: WritableTable; columns: TableColumnSchema[] }>(
      `/api/editor/writable-tables/${id}/schema`
    )

  const getRows = (id: string, limit = 50) =>
    $fetch<{ columns: string[]; rows: Record<string, unknown>[] }>(
      `/api/editor/writable-tables/${id}/rows`,
      { query: { limit } }
    )

  const insertRow = (id: string, values: Record<string, unknown>) =>
    $fetch<{ rowCount: number; rows: Record<string, unknown>[] }>(
      `/api/editor/writable-tables/${id}/insert`,
      {
        method: 'POST',
        body: { values }
      }
    )

  const updateRows = (
    id: string,
    values: Record<string, unknown>,
    where: Record<string, unknown>
  ) =>
    $fetch<{ rowCount: number; rows: Record<string, unknown>[] }>(
      `/api/editor/writable-tables/${id}/update`,
      {
        method: 'PUT',
        body: { values, where }
      }
    )

  return {
    listWritableTables,
    getSchema,
    getRows,
    insertRow,
    updateRows
  }
}
