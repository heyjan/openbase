export interface DataSource {
  id: string
  name: string
  type: string
  connection: Record<string, unknown>
  is_active: boolean
  created_at: string
  last_sync_at: string | null
}

export interface DataSourceInput {
  name: string
  type: string
  connection: Record<string, unknown>
  is_active?: boolean
}

export interface DataSourceUpdate {
  name?: string
  connection?: Record<string, unknown>
  is_active?: boolean
}
