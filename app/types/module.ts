export type ModuleType =
  | 'time_series_chart'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'outlier_table'
  | 'kpi_card'
  | 'data_table'
  | 'annotation_log'
  | 'form_input'
  | 'header'
  | 'subheader'

export type TextModuleType = 'header' | 'subheader'

const textModuleTypeSet = new Set<ModuleType>(['header', 'subheader'])

export const isTextModuleType = (type: ModuleType): type is TextModuleType =>
  textModuleTypeSet.has(type)

export const getModuleMinGridWidth = (_type: ModuleType) => 3

export const getModuleMinGridHeight = (type: ModuleType) =>
  isTextModuleType(type) ? 1 : 2

export interface ModuleConfig {
  id: string
  dashboardId: string
  type: ModuleType
  title?: string
  config: Record<string, unknown>
  queryVisualizationId?: string
  queryVisualizationQueryId?: string
  gridX: number
  gridY: number
  gridW: number
  gridH: number
}

export interface ModuleInput {
  type: ModuleType
  title?: string
  config?: Record<string, unknown>
  queryVisualizationId?: string
  gridX?: number
  gridY?: number
  gridW?: number
  gridH?: number
}

export interface ModuleUpdate {
  title?: string
  config?: Record<string, unknown>
  queryVisualizationId?: string | null
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
