export type QueryPreviewVisualization =
  | 'table'
  | 'kpi'
  | 'line'
  | 'area'
  | 'bar'
  | 'stacked_horizontal_bar'
  | 'waterfall'
  | 'radar'
  | 'pie'
  | 'scatter'

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
  useThousandsSeparator?: boolean
  tabbed?: boolean
  tabGroupSeparator?: string
  tabSharedColumns?: string[]
  tabDefault?: string
  columnColors?: Record<string, string>
  columnGradients?: Record<string, boolean>
  columnValueFormats?: Record<string, TableColumnValueFormat>
  conditionalFormatting?: ConditionalFormatRule[]
}

export type KpiVizOptions = SharedVizOptions & {
  label?: string
  valueField?: string
  prefix?: string
  postfix?: string
  valueColor?: string
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

export type StackedHorizontalBarVizOptions = SharedVizOptions & {
  xField?: string
  series?: VizSeriesOption[]
  stacked?: boolean
  horizontal?: boolean
  showLegend?: boolean
  barBorderRadius?: number
}

export type WaterfallVizOptions = SharedVizOptions & {
  categoryField?: string
  valueField?: string
  positiveColor?: string
  negativeColor?: string
  totalColor?: string
  showLegend?: boolean
  barBorderRadius?: number
}

export type RadarVizOptions = SharedVizOptions & {
  xField?: string
  series?: VizSeriesOption[]
  showLegend?: boolean
}

export type PieVizOptions = SharedVizOptions & {
  categoryField?: string
  valueField?: string
  topN?: number
  donut?: boolean
  showLabels?: boolean
  showLegend?: boolean
}

export type ScatterVizMode = 'numeric' | 'category_compare'

export type ScatterCompareSeriesOption = {
  field: string
  label?: string
  color?: string
  sizeField?: string
}

export type ScatterVizOptions = SharedVizOptions & {
  mode?: ScatterVizMode
  xField?: string
  yField?: string
  sizeField?: string
  labelField?: string
  categoryField?: string
  series?: ScatterCompareSeriesOption[]
  minSymbolSize?: number
  maxSymbolSize?: number
  showLabels?: boolean
  yAxisMin?: number
  yAxisMax?: number
  yAxisInverse?: boolean
}

export type VizOptionsByType = {
  table: TableVizOptions
  kpi: KpiVizOptions
  line: LineVizOptions
  area: AreaVizOptions
  bar: BarVizOptions
  stacked_horizontal_bar: StackedHorizontalBarVizOptions
  waterfall: WaterfallVizOptions
  radar: RadarVizOptions
  pie: PieVizOptions
  scatter: ScatterVizOptions
}

export type VizOptions =
  | TableVizOptions
  | KpiVizOptions
  | LineVizOptions
  | AreaVizOptions
  | BarVizOptions
  | StackedHorizontalBarVizOptions
  | WaterfallVizOptions
  | RadarVizOptions
  | PieVizOptions
  | ScatterVizOptions
