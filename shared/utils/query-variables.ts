export type VariableType = 'text' | 'number' | 'select' | 'query_list'

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
}

export type QueryParameterConfig = Record<string, unknown> & {
  variables?: VariableDefinition[]
}

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const variableTokenPattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

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
    type !== 'query_list'
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

  const options =
    value.options === undefined
      ? undefined
      : Array.isArray(value.options)
        ? value.options.map((option) => parseVariableOption(option, name))
        : (() => {
            throw new Error(`Invalid variable options for "${name}"`)
          })()

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
      typeof value.labelColumn === 'string' ? value.labelColumn.trim() || undefined : undefined
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

  for (const variableName of variables) {
    if (hasOwn(runtimeParameters, variableName)) {
      continue
    }

    const definition = definitionsByName.get(variableName)
    if (definition?.defaultValue !== undefined) {
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
