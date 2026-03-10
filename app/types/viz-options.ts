export type QueryPreviewVisualization = 'table' | 'line' | 'area' | 'bar' | 'pie' | 'scatter'

export type SortDirection = 'asc' | 'desc'

export type ConditionalFormatOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'neq'
  | 'between'
  | 'contains'

export type ConditionalFormatStyle = 'background' | 'text' | 'bar'

export type ConditionalFormatRule = {
  column: string
  operator: ConditionalFormatOperator
  value: number | string
  valueTo?: number
  style: ConditionalFormatStyle
  color: string
  colorTo?: string
}

export type VizSeriesOption = {
  field: string
  label?: string
  color?: string
}

type SharedVizOptions = {
  titleOverride?: string
}

export type TableColumnValueFormat = {
  prefix?: string
  suffix?: string
}

export type TableVizOptions = SharedVizOptions & {
  visibleColumns?: string[]
  columnOrder?: string[]
  sortColumn?: string
  sortDirection?: SortDirection
  rowLimit?: number
  showSearch?: boolean
  columnColors?: Record<string, string>
  columnGradients?: Record<string, boolean>
  columnValueFormats?: Record<string, TableColumnValueFormat>
  conditionalFormatting?: ConditionalFormatRule[]
}

export type LineVizOptions = SharedVizOptions & {
  xField?: string
  series?: VizSeriesOption[]
  smooth?: boolean
  showSymbols?: boolean
  area?: boolean
  yAxisMin?: number
  yAxisMax?: number
  showLegend?: boolean
}

export type AreaVizOptions = LineVizOptions

export type BarVizOptions = SharedVizOptions & {
  xField?: string
  series?: VizSeriesOption[]
  stacked?: boolean
  horizontal?: boolean
  showLegend?: boolean
  barBorderRadius?: number
}

export type PieVizOptions = SharedVizOptions & {
  categoryField?: string
  valueField?: string
  topN?: number
  donut?: boolean
  showLabels?: boolean
  showLegend?: boolean
}

export type ScatterVizOptions = SharedVizOptions & {
  xField?: string
  yField?: string
  sizeField?: string
  labelField?: string
  minSymbolSize?: number
  maxSymbolSize?: number
  showLabels?: boolean
}

export type VizOptionsByType = {
  table: TableVizOptions
  line: LineVizOptions
  area: AreaVizOptions
  bar: BarVizOptions
  pie: PieVizOptions
  scatter: ScatterVizOptions
}

export type VizOptions =
  | TableVizOptions
  | LineVizOptions
  | AreaVizOptions
  | BarVizOptions
  | PieVizOptions
  | ScatterVizOptions
