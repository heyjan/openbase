export type VariableType = 'text' | 'number' | 'select' | 'query_list' | 'date_range'

export type VariableOption = {
  label: string
  value: string
}

export type VariableDefinition = {
  name: string
  label?: string
  type?: VariableType
  required?: boolean
  defaultValue?: string | number | null
  options?: VariableOption[]
  sourceQueryId?: string
  valueColumn?: string
  labelColumn?: string
  dateRangeConfig?: {
    minYear?: number
    maxYear?: number
    defaultFrom?: string
    defaultTo?: string
  }
}

export type QueryParameterConfig = Record<string, unknown> & {
  variables?: VariableDefinition[]
}

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

const isProvidedValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return true
}

const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const variableTokenPattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g
const yearMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseVariableOption = (value: unknown, variableName: string): VariableOption => {
  if (!isRecord(value)) {
    throw new Error(`Invalid variable option for "${variableName}"`)
  }

  if (typeof value.label !== 'string' || !value.label.trim()) {
    throw new Error(`Invalid variable option label for "${variableName}"`)
  }

  if (typeof value.value !== 'string') {
    throw new Error(`Invalid variable option value for "${variableName}"`)
  }

  return {
    label: value.label.trim(),
    value: value.value
  }
}

const parseVariableDefinition = (value: unknown): VariableDefinition => {
  if (!isRecord(value)) {
    throw new Error('Invalid variable definition')
  }

  if (typeof value.name !== 'string' || !variableNamePattern.test(value.name.trim())) {
    throw new Error('Invalid variable name')
  }

  const name = value.name.trim()
  const type = value.type
  if (
    type !== undefined &&
    type !== 'text' &&
    type !== 'number' &&
    type !== 'select' &&
    type !== 'query_list' &&
    type !== 'date_range'
  ) {
    throw new Error(`Invalid variable type for "${name}"`)
  }

  if (value.label !== undefined && typeof value.label !== 'string') {
    throw new Error(`Invalid variable label for "${name}"`)
  }
  if (value.required !== undefined && typeof value.required !== 'boolean') {
    throw new Error(`Invalid variable required flag for "${name}"`)
  }
  if (
    value.defaultValue !== undefined &&
    value.defaultValue !== null &&
    typeof value.defaultValue !== 'string' &&
    typeof value.defaultValue !== 'number'
  ) {
    throw new Error(`Invalid variable default value for "${name}"`)
  }
  if (value.sourceQueryId !== undefined && typeof value.sourceQueryId !== 'string') {
    throw new Error(`Invalid variable sourceQueryId for "${name}"`)
  }
  if (value.valueColumn !== undefined && typeof value.valueColumn !== 'string') {
    throw new Error(`Invalid variable valueColumn for "${name}"`)
  }
  if (value.labelColumn !== undefined && typeof value.labelColumn !== 'string') {
    throw new Error(`Invalid variable labelColumn for "${name}"`)
  }
  if (value.dateRangeConfig !== undefined && value.dateRangeConfig !== null) {
    if (!isRecord(value.dateRangeConfig)) {
      throw new Error(`Invalid variable dateRangeConfig for "${name}"`)
    }
    const dateRangeConfig = value.dateRangeConfig as Record<string, unknown>
    if (
      dateRangeConfig.minYear !== undefined &&
      (typeof dateRangeConfig.minYear !== 'number' ||
        !Number.isInteger(dateRangeConfig.minYear))
    ) {
      throw new Error(`Invalid variable minYear for "${name}"`)
    }
    if (
      dateRangeConfig.maxYear !== undefined &&
      (typeof dateRangeConfig.maxYear !== 'number' ||
        !Number.isInteger(dateRangeConfig.maxYear))
    ) {
      throw new Error(`Invalid variable maxYear for "${name}"`)
    }
    if (
      dateRangeConfig.defaultFrom !== undefined &&
      (typeof dateRangeConfig.defaultFrom !== 'string' ||
        !yearMonthPattern.test(dateRangeConfig.defaultFrom))
    ) {
      throw new Error(`Invalid variable defaultFrom for "${name}"`)
    }
    if (
      dateRangeConfig.defaultTo !== undefined &&
      (typeof dateRangeConfig.defaultTo !== 'string' ||
        !yearMonthPattern.test(dateRangeConfig.defaultTo))
    ) {
      throw new Error(`Invalid variable defaultTo for "${name}"`)
    }
  }

  const options =
    value.options === undefined
      ? undefined
      : Array.isArray(value.options)
        ? value.options.map((option) => parseVariableOption(option, name))
        : (() => {
            throw new Error(`Invalid variable options for "${name}"`)
          })()

  const dateRangeConfig =
    value.dateRangeConfig && isRecord(value.dateRangeConfig)
      ? {
          minYear:
            typeof value.dateRangeConfig.minYear === 'number'
              ? value.dateRangeConfig.minYear
              : undefined,
          maxYear:
            typeof value.dateRangeConfig.maxYear === 'number'
              ? value.dateRangeConfig.maxYear
              : undefined,
          defaultFrom:
            typeof value.dateRangeConfig.defaultFrom === 'string'
              ? value.dateRangeConfig.defaultFrom
              : undefined,
          defaultTo:
            typeof value.dateRangeConfig.defaultTo === 'string'
              ? value.dateRangeConfig.defaultTo
              : undefined
        }
      : undefined

  return {
    name,
    label: typeof value.label === 'string' ? value.label.trim() || undefined : undefined,
    type,
    required: value.required === true,
    defaultValue:
      value.defaultValue === undefined
        ? undefined
        : (value.defaultValue as string | number | null),
    options,
    sourceQueryId:
      typeof value.sourceQueryId === 'string' ? value.sourceQueryId.trim() || undefined : undefined,
    valueColumn:
      typeof value.valueColumn === 'string' ? value.valueColumn.trim() || undefined : undefined,
    labelColumn:
      typeof value.labelColumn === 'string' ? value.labelColumn.trim() || undefined : undefined,
    dateRangeConfig:
      dateRangeConfig &&
      (dateRangeConfig.minYear !== undefined ||
        dateRangeConfig.maxYear !== undefined ||
        dateRangeConfig.defaultFrom !== undefined ||
        dateRangeConfig.defaultTo !== undefined)
        ? dateRangeConfig
        : undefined
  }
}

export const extractVariables = (queryText: string): string[] => {
  const variables: string[] = []
  const seen = new Set<string>()
  const input = typeof queryText === 'string' ? queryText : ''
  variableTokenPattern.lastIndex = 0
  for (const match of input.matchAll(variableTokenPattern)) {
    const name = match[1]
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    variables.push(name)
  }
  return variables
}

export const parseVariableDefinitions = (parameters: unknown): VariableDefinition[] => {
  if (!isRecord(parameters) || parameters.variables === undefined || parameters.variables === null) {
    return []
  }
  if (!Array.isArray(parameters.variables)) {
    throw new Error('Invalid query parameters.variables')
  }
  return parameters.variables.map(parseVariableDefinition)
}

export const prepareQueryVariables = (input: {
  queryText: string
  runtimeParameters: Record<string, unknown>
  queryParameters?: unknown
}) => {
  const runtimeParameters = { ...input.runtimeParameters }
  const definitions = parseVariableDefinitions(input.queryParameters)
  const definitionsByName = new Map(definitions.map((definition) => [definition.name, definition]))
  const variables = extractVariables(input.queryText)

  for (const definition of definitions) {
    if (definition.type !== 'date_range') {
      continue
    }

    const hasRuntimeValue =
      hasOwn(runtimeParameters, definition.name) && isProvidedValue(runtimeParameters[definition.name])
    if (hasRuntimeValue) {
      continue
    }

    const defaultFrom = definition.dateRangeConfig?.defaultFrom
    const defaultTo = definition.dateRangeConfig?.defaultTo
    if (defaultFrom && defaultTo) {
      runtimeParameters[definition.name] = `${defaultFrom}|${defaultTo}`
    }
  }

  for (const definition of definitions) {
    if (definition.type !== 'date_range') {
      continue
    }

    const rawValue = runtimeParameters[definition.name]
    const parsedRawValue =
      typeof rawValue === 'string' && rawValue.includes('|') ? rawValue.split('|') : null

    if (parsedRawValue?.length === 2) {
      const from = parsedRawValue[0]?.trim()
      const to = parsedRawValue[1]?.trim()
      if (from && to && yearMonthPattern.test(from) && yearMonthPattern.test(to)) {
        const [fromYear, fromMonth] = from.split('-').map(Number)
        const [toYear, toMonth] = to.split('-').map(Number)
        const fromKey = fromYear * 100 + fromMonth
        const toKey = toYear * 100 + toMonth
        const start =
          fromKey <= toKey
            ? { year: fromYear, month: fromMonth }
            : { year: toYear, month: toMonth }
        const end =
          fromKey <= toKey
            ? { year: toYear, month: toMonth }
            : { year: fromYear, month: fromMonth }

        runtimeParameters[`${definition.name}_from_month`] = start.month
        runtimeParameters[`${definition.name}_from_year`] = start.year
        runtimeParameters[`${definition.name}_to_month`] = end.month
        runtimeParameters[`${definition.name}_to_year`] = end.year
      }
    }

    delete runtimeParameters[definition.name]
  }

  for (const variableName of variables) {
    const hasRuntimeValue =
      hasOwn(runtimeParameters, variableName) && isProvidedValue(runtimeParameters[variableName])
    if (hasRuntimeValue) {
      continue
    }

    const definition = definitionsByName.get(variableName)
    const hasDefaultValue =
      definition !== undefined && isProvidedValue(definition.defaultValue)
    if (hasDefaultValue) {
      runtimeParameters[variableName] = definition.defaultValue
      continue
    }
    if (definition?.required) {
      throw new Error(`Missing required query variable: ${variableName}`)
    }
    runtimeParameters[variableName] = null
  }

  variableTokenPattern.lastIndex = 0
  const queryText = input.queryText.replace(variableTokenPattern, (_match, variableName: string) => {
    return `:${variableName}`
  })

  return {
    queryText,
    parameters: runtimeParameters,
    variables
  }
}
