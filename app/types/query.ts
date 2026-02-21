export type SavedQuery = {
  id: string
  dataSourceId: string
  dataSourceName?: string
  name: string
  description?: string
  queryText: string
  parameters: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type SavedQueryInput = {
  dataSourceId: string
  name: string
  description?: string
  queryText: string
  parameters?: Record<string, unknown>
}

export type SavedQueryPreviewResult = {
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  limit: number
}
