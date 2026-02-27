import type { Dashboard } from './dashboard'

export interface EditorUser {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export interface WritableTable {
  id: string
  dataSourceId: string
  dataSourceName?: string
  dataSourceType?: string
  tableName: string
  allowedColumns: string[] | null
  allowInsert: boolean
  allowUpdate: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface EditorPermissionsResponse {
  editor: EditorUser
  dashboardIds: string[]
  writableTableIds: string[]
  availableDashboards: Dashboard[]
  availableWritableTables: WritableTable[]
}

export interface TableColumnSchema {
  columnName: string
  dataType: string
  isNullable: boolean
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  udtName: string
}
