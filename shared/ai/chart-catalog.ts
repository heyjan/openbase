export type AgentChartCatalogEntry = {
  moduleType: string
  label: string
  useWhen: string
  requiredConfig: string[]
  optionalConfig: string[]
}

export const AGENT_CHART_CATALOG: AgentChartCatalogEntry[] = [
  {
    moduleType: 'line_chart',
    label: 'Line chart',
    useWhen: 'Compare one or more numeric series over ordered categories or time buckets.',
    requiredConfig: ['xField', 'series'],
    optionalConfig: ['smooth', 'area', 'showLegend', 'showSymbols', 'yAxisMin', 'yAxisMax']
  },
  {
    moduleType: 'time_series_chart',
    label: 'Time series chart',
    useWhen: 'Show trends over dates or months. Uses the same xField and series config as line_chart.',
    requiredConfig: ['xField', 'series'],
    optionalConfig: ['smooth', 'area', 'showLegend', 'showSymbols', 'yAxisMin', 'yAxisMax']
  },
  {
    moduleType: 'bar_chart',
    label: 'Bar chart',
    useWhen: 'Compare numeric values across discrete categories.',
    requiredConfig: ['xField', 'series'],
    optionalConfig: ['horizontal', 'stacked', 'showLegend', 'barBorderRadius', 'xAxisLabelRotation']
  },
  {
    moduleType: 'stacked_horizontal_bar_chart',
    label: 'Stacked horizontal bar chart',
    useWhen: 'Compare category totals with one or more stacked components and long category labels.',
    requiredConfig: ['xField', 'series'],
    optionalConfig: ['showLegend', 'barBorderRadius']
  },
  {
    moduleType: 'pie_chart',
    label: 'Pie chart',
    useWhen: 'Show part-to-whole composition for a small number of categories.',
    requiredConfig: ['categoryField', 'valueField'],
    optionalConfig: ['donut', 'showLabels', 'showLegend', 'topN']
  },
  {
    moduleType: 'kpi_card',
    label: 'KPI card',
    useWhen: 'Show one headline metric.',
    requiredConfig: ['valueField'],
    optionalConfig: ['label', 'prefix', 'suffix', 'valueColor']
  },
  {
    moduleType: 'data_table',
    label: 'Data table',
    useWhen: 'Show detailed rows when a chart would hide important record-level data.',
    requiredConfig: [],
    optionalConfig: ['visibleColumns', 'columnOrder', 'showSearch', 'limit']
  },
  {
    moduleType: 'scatter_chart',
    label: 'Scatter chart',
    useWhen: 'Compare two numeric measures and optionally group by category.',
    requiredConfig: ['xField', 'yField'],
    optionalConfig: ['categoryField', 'sizeField', 'showLegend']
  },
  {
    moduleType: 'waterfall_chart',
    label: 'Waterfall chart',
    useWhen: 'Show positive and negative contributions to a running total.',
    requiredConfig: ['categoryField', 'valueField'],
    optionalConfig: ['positiveColor', 'negativeColor', 'totalColor', 'showLegend']
  },
  {
    moduleType: 'radar_chart',
    label: 'Radar chart',
    useWhen: 'Compare multiple numeric dimensions across a small set of entities.',
    requiredConfig: ['xField', 'series'],
    optionalConfig: ['showLegend']
  }
]
