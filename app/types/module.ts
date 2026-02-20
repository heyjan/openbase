export type ModuleType =
  | 'time_series_chart'
  | 'outlier_table'
  | 'kpi_card'
  | 'data_table'
  | 'annotation_log'
  | 'form_input'

export interface ModuleConfig {
  id: string
  dashboardId: string
  type: ModuleType
  title?: string
  config: Record<string, unknown>
  gridX: number
  gridY: number
  gridW: number
  gridH: number
}

export interface ModuleInput {
  type: ModuleType
  title?: string
  config?: Record<string, unknown>
  gridX?: number
  gridY?: number
  gridW?: number
  gridH?: number
}

export interface ModuleUpdate {
  title?: string
  config?: Record<string, unknown>
  gridX?: number
  gridY?: number
  gridW?: number
  gridH?: number
}

export interface ModuleLayoutUpdate {
  id: string
  gridX: number
  gridY: number
  gridW: number
  gridH: number
}
