import type { Ref } from 'vue'
import type {
  ConditionalFormatOperator,
  ConditionalFormatRule,
  QueryPreviewVisualization,
  VizOptionsByType,
  VizSeriesOption
} from '~/types/viz-options'

const DEFAULT_PALETTE = ['#1f2937', '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const DECIMAL_COMMA_PATTERN = /^-?\d+(?:,\d+)?$/

export const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
    if (!DECIMAL_COMMA_PATTERN.test(trimmed)) {
      return null
    }
    const commaParsed = Number(trimmed.replace(',', '.'))
    return Number.isFinite(commaParsed) ? commaParsed : null
  }
  return null
}

const readConfiguredValue = (config: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      return config[key]
    }
  }
  return undefined
}

const readConfiguredStringArray = (config: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = config[key]
    if (isStringArray(value)) {
      return value
    }
  }
  return []
}

const readConfiguredString = (config: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

export const columnIsNumeric = (rows: Record<string, unknown>[], column: string) => {
  let sawValue = false

  for (const row of rows) {
    const value = row[column]
    if (value === null || value === undefined || value === '') {
      continue
    }

    sawValue = true
    if (toNumber(value) === null) {
      return false
    }
  }

  return sawValue
}

export const getNumericColumns = (rows: Record<string, unknown>[], columns: string[]) =>
  columns.filter((column) => columnIsNumeric(rows, column))

export const getCategoryColumns = (columns: string[], numericColumns: string[]) => {
  const categoryColumns = columns.filter((column) => !numericColumns.includes(column))
  return categoryColumns.length ? categoryColumns : columns
}

const getDefaultSeries = (
  fields: string[],
  limit = 4
): VizSeriesOption[] =>
  fields.slice(0, limit).map((field, index) => ({
    field,
    label: field,
    color: DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
  }))

const clone = <T>(value: T): T => {
  if (value === undefined || value === null) {
    return value
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const mergeRecords = (base: Record<string, unknown>, override: Record<string, unknown>) => {
  const merged: Record<string, unknown> = { ...base }

  for (const key of Object.keys(override)) {
    const value = override[key]
    const current = merged[key]

    if (value === undefined) {
      continue
    }

    if (isRecord(current) && isRecord(value)) {
      merged[key] = mergeRecords(current, value)
      continue
    }

    merged[key] = clone(value)
  }

  return merged
}

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }
    return left.every((value, index) => deepEqual(value, right[index]))
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false
      }
      if (!deepEqual(left[key], right[key])) {
        return false
      }
    }

    return true
  }

  return false
}

const sortDirectionFromConfig = (value: unknown) =>
  value === 'desc' ? 'desc' : 'asc'

const positiveIntegerFromConfig = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  const rounded = Math.trunc(value)
  return rounded > 0 ? rounded : fallback
}

const readConfiguredPositiveInteger = (
  config: Record<string, unknown>,
  keys: string[],
  fallback: number
) => positiveIntegerFromConfig(readConfiguredValue(config, keys), fallback)

const parseSeries = (
  value: unknown,
  fallbackFields: string[],
  limit = 6
): VizSeriesOption[] => {
  if (!Array.isArray(value)) {
    return getDefaultSeries(fallbackFields, limit)
  }

  const parsed = value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null
      }

      const field = typeof entry.field === 'string' ? entry.field.trim() : ''
      if (!field || !fallbackFields.includes(field)) {
        return null
      }

      const label =
        typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : field
      const color =
        typeof entry.color === 'string' && entry.color.trim()
          ? entry.color.trim()
          : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]

      return {
        field,
        label,
        color
      }
    })
    .filter((entry): entry is VizSeriesOption => entry !== null)

  return parsed.length ? parsed : getDefaultSeries(fallbackFields, limit)
}

const readConfiguredField = (
  config: Record<string, unknown>,
  keys: string[],
  allowed: string[],
  fallback = ''
) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim() && allowed.includes(value.trim())) {
      return value.trim()
    }
  }
  return fallback
}

const readConfiguredNumber = (config: Record<string, unknown>, keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return fallback
}

const readConfiguredOptionalNumber = (config: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

const readConfiguredBoolean = (config: Record<string, unknown>, keys: string[], fallback: boolean) => {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return fallback
}

export const buildAutoVizConfig = <T extends QueryPreviewVisualization>(
  visualization: T,
  columns: string[],
  rows: Record<string, unknown>[],
  queryName: string
): VizOptionsByType[T] => {
  const numericColumns = getNumericColumns(rows, columns)
  const categoryColumns = getCategoryColumns(columns, numericColumns)
  const primaryCategory = categoryColumns[0] ?? ''

  const seriesFields = (
    numericColumns.filter((column) => column !== primaryCategory).length
      ? numericColumns.filter((column) => column !== primaryCategory)
      : numericColumns
  )

  const baseTitle = queryName.trim() || 'Query'

  if (visualization === 'table') {
    return {
      titleOverride: baseTitle,
      visibleColumns: [...columns],
      columnOrder: [...columns],
      sortDirection: 'asc',
      rowLimit: 500,
      showSearch: false,
      conditionalFormatting: []
    } as VizOptionsByType[T]
  }

  if (visualization === 'line' || visualization === 'area') {
    return {
      titleOverride: baseTitle,
      xField: primaryCategory,
      series: getDefaultSeries(seriesFields, 6),
      smooth: true,
      showSymbols: false,
      area: visualization === 'area',
      showLegend: true
    } as VizOptionsByType[T]
  }

  if (visualization === 'bar') {
    return {
      titleOverride: baseTitle,
      xField: primaryCategory,
      series: getDefaultSeries(seriesFields, 6),
      stacked: false,
      horizontal: false,
      showLegend: true,
      barBorderRadius: 4
    } as VizOptionsByType[T]
  }

  if (visualization === 'pie') {
    const categoryField = categoryColumns[0] ?? columns[0] ?? ''
    const valueField =
      numericColumns.find((column) => column !== categoryField) ?? numericColumns[0] ?? ''

    return {
      titleOverride: baseTitle,
      categoryField,
      valueField,
      topN: 8,
      donut: true,
      showLabels: false,
      showLegend: true
    } as VizOptionsByType[T]
  }

  const xField = numericColumns[0] ?? ''
  const yField = numericColumns.find((column) => column !== xField) ?? numericColumns[1] ?? ''
  const sizeField =
    numericColumns.find((column) => column !== xField && column !== yField) ?? yField
  const labelField = categoryColumns[0] ?? ''

  return {
    titleOverride: baseTitle,
    xField,
    yField,
    sizeField,
    labelField,
    minSymbolSize: 10,
    maxSymbolSize: 42,
    showLabels: false
  } as VizOptionsByType[T]
}

const sanitizeVizConfigForType = (
  visualization: QueryPreviewVisualization,
  config: Record<string, unknown>,
  columns: string[],
  rows: Record<string, unknown>[],
  queryName: string
) => {
  const defaults = buildAutoVizConfig(visualization, columns, rows, queryName)
  const normalized = mergeRecords(defaults as Record<string, unknown>, config)

  const numericColumns = getNumericColumns(rows, columns)
  const categoryColumns = getCategoryColumns(columns, numericColumns)

  if (visualization === 'table') {
    const columnOrder = readConfiguredStringArray(normalized, ['columnOrder', 'column_order'])
      .filter((column) => columns.includes(column))
    const deduplicatedOrder = columnOrder.filter(
      (column, index, source) => source.indexOf(column) === index
    )
    const ordered = [
      ...deduplicatedOrder,
      ...columns.filter((column) => !deduplicatedOrder.includes(column))
    ]

    const configuredVisible = readConfiguredStringArray(
      normalized,
      ['visibleColumns', 'visible_columns']
    )
    const visibleColumns = configuredVisible.length
      ? ordered.filter((column) => configuredVisible.includes(column))
      : ordered

    normalized.columnOrder = ordered
    normalized.visibleColumns = visibleColumns
    const sortColumn = readConfiguredString(normalized, ['sortColumn', 'sort_column'])
    normalized.sortColumn = sortColumn && columns.includes(sortColumn) ? sortColumn : undefined
    normalized.sortDirection = sortDirectionFromConfig(
      readConfiguredValue(normalized, ['sortDirection', 'sort_direction'])
    )
    normalized.rowLimit = readConfiguredPositiveInteger(normalized, ['rowLimit', 'row_limit'], 500)
    normalized.showSearch = readConfiguredBoolean(normalized, ['showSearch', 'show_search'], false)
    normalized.conditionalFormatting = parseConditionalFormattingRules(
      normalized.conditionalFormatting
    )
    return normalized
  }

  if (visualization === 'line' || visualization === 'area' || visualization === 'bar') {
    const xField = readConfiguredField(
      normalized,
      ['xField', 'x_field'],
      [...categoryColumns, ...numericColumns],
      typeof defaults.xField === 'string' ? defaults.xField : ''
    )

    const fallbackFields =
      numericColumns.filter((column) => column !== xField).length > 0
        ? numericColumns.filter((column) => column !== xField)
        : numericColumns

    normalized.xField = xField
    normalized.series = parseSeries(normalized.series, fallbackFields, 6)

    if (visualization === 'line' || visualization === 'area') {
      normalized.smooth = readConfiguredBoolean(normalized, ['smooth'], true)
      normalized.showSymbols = readConfiguredBoolean(
        normalized,
        ['showSymbols', 'show_symbols'],
        false
      )
      normalized.area = readConfiguredBoolean(
        normalized,
        ['area'],
        visualization === 'area'
      )
      normalized.yAxisMin = readConfiguredOptionalNumber(normalized, ['yAxisMin', 'y_axis_min'])
      normalized.yAxisMax = readConfiguredOptionalNumber(normalized, ['yAxisMax', 'y_axis_max'])
    }

    if (visualization === 'bar') {
      normalized.stacked = readConfiguredBoolean(normalized, ['stacked'], false)
      normalized.horizontal = readConfiguredBoolean(normalized, ['horizontal'], false)
      normalized.barBorderRadius = readConfiguredNumber(
        normalized,
        ['barBorderRadius', 'bar_border_radius'],
        4
      )
    }

    normalized.showLegend = readConfiguredBoolean(
      normalized,
      ['showLegend', 'show_legend'],
      true
    )
    return normalized
  }

  if (visualization === 'pie') {
    normalized.categoryField = readConfiguredField(
      normalized,
      ['categoryField', 'category_field'],
      columns,
      typeof defaults.categoryField === 'string' ? defaults.categoryField : ''
    )
    normalized.valueField = readConfiguredField(
      normalized,
      ['valueField', 'value_field'],
      numericColumns,
      typeof defaults.valueField === 'string' ? defaults.valueField : ''
    )
    normalized.topN = positiveIntegerFromConfig(normalized.topN ?? normalized.top_n, 8)
    normalized.donut = readConfiguredBoolean(normalized, ['donut'], true)
    normalized.showLabels = readConfiguredBoolean(normalized, ['showLabels', 'show_labels'], false)
    normalized.showLegend = readConfiguredBoolean(normalized, ['showLegend', 'show_legend'], true)
    return normalized
  }

  normalized.xField = readConfiguredField(
    normalized,
    ['xField', 'x_field'],
    numericColumns,
    typeof defaults.xField === 'string' ? defaults.xField : ''
  )
  normalized.yField = readConfiguredField(
    normalized,
    ['yField', 'y_field'],
    numericColumns,
    typeof defaults.yField === 'string' ? defaults.yField : ''
  )
  normalized.sizeField = readConfiguredField(
    normalized,
    ['sizeField', 'size_field'],
    numericColumns,
    typeof defaults.sizeField === 'string' ? defaults.sizeField : ''
  )
  normalized.labelField = readConfiguredField(
    normalized,
    ['labelField', 'label_field'],
    columns,
    typeof defaults.labelField === 'string' ? defaults.labelField : ''
  )
  normalized.minSymbolSize = readConfiguredNumber(
    normalized,
    ['minSymbolSize', 'min_symbol_size'],
    10
  )
  normalized.maxSymbolSize = readConfiguredNumber(
    normalized,
    ['maxSymbolSize', 'max_symbol_size'],
    42
  )
  normalized.showLabels = readConfiguredBoolean(normalized, ['showLabels', 'show_labels'], false)
  return normalized
}

const countTopLevelDifferences = (current: Record<string, unknown>, defaults: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(current), ...Object.keys(defaults)])
  let total = 0
  for (const key of keys) {
    if (!deepEqual(current[key], defaults[key])) {
      total += 1
    }
  }
  return total
}

export const resolveTableColumnOrder = (columns: string[], config: Record<string, unknown>) => {
  const configuredOrder = readConfiguredStringArray(config, ['columnOrder', 'column_order'])
    .filter(
      (column, index, source) =>
        columns.includes(column) && source.indexOf(column) === index
    )

  return [...configuredOrder, ...columns.filter((column) => !configuredOrder.includes(column))]
}

export const resolveTableVisibleColumns = (orderedColumns: string[], config: Record<string, unknown>) => {
  const configuredVisible = readConfiguredStringArray(
    config,
    ['visibleColumns', 'visible_columns']
  ).filter((column) => orderedColumns.includes(column))

  if (!configuredVisible.length) {
    return orderedColumns
  }

  return orderedColumns.filter((column) => configuredVisible.includes(column))
}

const compareValues = (left: unknown, right: unknown) => {
  const leftNumeric = toNumber(left)
  const rightNumeric = toNumber(right)

  if (leftNumeric !== null && rightNumeric !== null) {
    return leftNumeric - rightNumeric
  }

  const leftText = left === null || left === undefined ? '' : String(left)
  const rightText = right === null || right === undefined ? '' : String(right)
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })
}

export const applyTableSortAndLimit = (
  rows: Record<string, unknown>[],
  config: Record<string, unknown>
) => {
  const nextRows = [...rows]
  const sortColumn = readConfiguredString(config, ['sortColumn', 'sort_column'])
  const sortDirection = sortDirectionFromConfig(
    readConfiguredValue(config, ['sortDirection', 'sort_direction'])
  )

  if (sortColumn) {
    nextRows.sort((leftRow, rightRow) => {
      const diff = compareValues(leftRow[sortColumn], rightRow[sortColumn])
      return sortDirection === 'desc' ? -diff : diff
    })
  }

  const rowLimit = readConfiguredPositiveInteger(config, ['rowLimit', 'row_limit'], 500)
  return nextRows.slice(0, rowLimit)
}

const isConditionalOperator = (value: unknown): value is ConditionalFormatOperator =>
  value === 'gt' ||
  value === 'gte' ||
  value === 'lt' ||
  value === 'lte' ||
  value === 'eq' ||
  value === 'neq' ||
  value === 'between' ||
  value === 'contains'

const parseRuleNumber = (value: unknown): number | undefined => {
  const parsed = toNumber(value)
  return parsed === null ? undefined : parsed
}

export const parseConditionalFormattingRules = (value: unknown): ConditionalFormatRule[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null
      }

      const column = typeof entry.column === 'string' ? entry.column.trim() : ''
      const operator = isConditionalOperator(entry.operator) ? entry.operator : 'gt'
      const style =
        entry.style === 'background' || entry.style === 'text' || entry.style === 'bar'
          ? entry.style
          : 'background'
      const color =
        typeof entry.color === 'string' && entry.color.trim() ? entry.color.trim() : '#fca5a5'

      if (!column) {
        return null
      }

      const rawValue = entry.value
      const valueNumber = parseRuleNumber(rawValue)
      const normalizedValue: number | string =
        valueNumber !== undefined ? valueNumber : typeof rawValue === 'string' ? rawValue : ''

      const valueTo = parseRuleNumber(entry.valueTo)
      const colorTo = typeof entry.colorTo === 'string' && entry.colorTo.trim()
        ? entry.colorTo.trim()
        : undefined

      return {
        column,
        operator,
        value: normalizedValue,
        valueTo,
        style,
        color,
        colorTo
      } as ConditionalFormatRule
    })
    .filter((rule): rule is ConditionalFormatRule => rule !== null)
}

const doesRuleMatch = (value: unknown, rule: ConditionalFormatRule) => {
  const numericValue = toNumber(value)
  const ruleValueNumber = typeof rule.value === 'number' ? rule.value : parseRuleNumber(rule.value)
  const valueText = value === null || value === undefined ? '' : String(value).toLowerCase()

  switch (rule.operator) {
    case 'gt':
      return numericValue !== null && ruleValueNumber !== undefined && numericValue > ruleValueNumber
    case 'gte':
      return numericValue !== null && ruleValueNumber !== undefined && numericValue >= ruleValueNumber
    case 'lt':
      return numericValue !== null && ruleValueNumber !== undefined && numericValue < ruleValueNumber
    case 'lte':
      return numericValue !== null && ruleValueNumber !== undefined && numericValue <= ruleValueNumber
    case 'eq':
      return numericValue !== null && ruleValueNumber !== undefined
        ? numericValue === ruleValueNumber
        : valueText === String(rule.value).toLowerCase()
    case 'neq':
      return numericValue !== null && ruleValueNumber !== undefined
        ? numericValue !== ruleValueNumber
        : valueText !== String(rule.value).toLowerCase()
    case 'between':
      return (
        numericValue !== null &&
        ruleValueNumber !== undefined &&
        rule.valueTo !== undefined &&
        numericValue >= Math.min(ruleValueNumber, rule.valueTo) &&
        numericValue <= Math.max(ruleValueNumber, rule.valueTo)
      )
    case 'contains':
      return valueText.includes(String(rule.value).toLowerCase())
    default:
      return false
  }
}

export const getColumnNumericExtents = (
  rows: Record<string, unknown>[],
  columns: string[]
): Record<string, { min: number; max: number }> => {
  const extents: Record<string, { min: number; max: number }> = {}

  for (const column of columns) {
    const values = rows
      .map((row) => toNumber(row[column]))
      .filter((entry): entry is number => entry !== null)

    if (!values.length) {
      continue
    }

    extents[column] = {
      min: Math.min(...values),
      max: Math.max(...values)
    }
  }

  return extents
}

export const getConditionalCellStyle = (input: {
  columnKey: string
  value: unknown
  rules: ConditionalFormatRule[]
  columnExtents?: Record<string, { min: number; max: number }>
}) => {
  const style: Record<string, string> = {}

  for (const rule of input.rules) {
    if (rule.column !== input.columnKey) {
      continue
    }

    if (!doesRuleMatch(input.value, rule)) {
      continue
    }

    if (rule.style === 'text') {
      style.color = rule.color
      continue
    }

    if (rule.style === 'background') {
      style.backgroundColor = rule.color
      continue
    }

    const numericValue = toNumber(input.value)
    const extent = input.columnExtents?.[input.columnKey]
    let percentage = 100

    if (numericValue !== null && extent && extent.max > extent.min) {
      const ratio = (numericValue - extent.min) / (extent.max - extent.min)
      const clamped = Math.max(0, Math.min(1, ratio))
      percentage = Math.round(clamped * 100)
    }

    const gradientEnd = rule.colorTo ?? 'transparent'
    style.background = `linear-gradient(90deg, ${rule.color} ${percentage}%, ${gradientEnd} ${percentage}%)`
  }

  return Object.keys(style).length ? style : undefined
}

export const useVizConfig = (input: {
  visualizationType: Ref<QueryPreviewVisualization>
  columns: Ref<string[]>
  rows: Ref<Record<string, unknown>[]>
  queryName: Ref<string>
  savedConfigByType?: Ref<Partial<Record<QueryPreviewVisualization, Record<string, unknown>>>>
}) => {
  const overridesByType = reactive<Partial<Record<QueryPreviewVisualization, Record<string, unknown>>>>({})

  const autoConfigByType = computed(() => {
    const columns = input.columns.value
    const rows = input.rows.value
    const queryName = input.queryName.value

    return {
      table: buildAutoVizConfig('table', columns, rows, queryName),
      line: buildAutoVizConfig('line', columns, rows, queryName),
      area: buildAutoVizConfig('area', columns, rows, queryName),
      bar: buildAutoVizConfig('bar', columns, rows, queryName),
      pie: buildAutoVizConfig('pie', columns, rows, queryName),
      scatter: buildAutoVizConfig('scatter', columns, rows, queryName)
    } as Record<QueryPreviewVisualization, Record<string, unknown>>
  })

  const savedConfigByType = computed<Partial<Record<QueryPreviewVisualization, Record<string, unknown>>>>(
    () => input.savedConfigByType?.value ?? {}
  )

  const baseConfigByType = computed(() => {
    const columns = input.columns.value
    const rows = input.rows.value
    const queryName = input.queryName.value

    const next = {} as Record<QueryPreviewVisualization, Record<string, unknown>>

    for (const visualization of ['table', 'line', 'area', 'bar', 'pie', 'scatter'] as const) {
      const autoConfig = autoConfigByType.value[visualization]
      const savedConfig = savedConfigByType.value[visualization]

      const merged = mergeRecords(
        autoConfig,
        isRecord(savedConfig) ? savedConfig : {}
      )

      next[visualization] = sanitizeVizConfigForType(
        visualization,
        merged,
        columns,
        rows,
        queryName
      )
    }

    return next
  })

  const resolvedConfigByType = computed(() => {
    const columns = input.columns.value
    const rows = input.rows.value
    const queryName = input.queryName.value

    const next = {} as Record<QueryPreviewVisualization, Record<string, unknown>>

    for (const visualization of ['table', 'line', 'area', 'bar', 'pie', 'scatter'] as const) {
      const baseConfig = baseConfigByType.value[visualization]
      const override = overridesByType[visualization]

      const merged = mergeRecords(baseConfig, isRecord(override) ? override : {})

      next[visualization] = sanitizeVizConfigForType(
        visualization,
        merged,
        columns,
        rows,
        queryName
      )
    }

    return next
  })

  const config = computed(() => resolvedConfigByType.value[input.visualizationType.value])
  const autoConfig = computed(() => autoConfigByType.value[input.visualizationType.value])
  const baseConfig = computed(() => baseConfigByType.value[input.visualizationType.value])

  const setConfig = (nextConfig: Record<string, unknown>) => {
    const visualization = input.visualizationType.value
    overridesByType[visualization] = clone(nextConfig)
  }

  const updateConfig = (patch: Record<string, unknown>) => {
    setConfig({
      ...config.value,
      ...patch
    })
  }

  const resetToDefaults = () => {
    delete overridesByType[input.visualizationType.value]
  }

  const isModified = computed(() => !deepEqual(config.value, baseConfig.value))
  const customOptionsCount = computed(() =>
    countTopLevelDifferences(config.value, autoConfig.value)
  )

  const getConfigForType = (visualization: QueryPreviewVisualization) =>
    clone(resolvedConfigByType.value[visualization])

  return {
    config,
    autoConfig,
    baseConfig,
    isModified,
    customOptionsCount,
    setConfig,
    updateConfig,
    resetToDefaults,
    getConfigForType,
    overridesByType,
    resolvedConfigByType
  }
}
