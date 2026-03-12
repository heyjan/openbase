import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { listModules } from '~~/server/utils/dashboard-store'
import { getSavedQueryById } from '~~/server/utils/query-store'
import { runSavedQueryById } from '~~/server/utils/query-runner'
import {
  extractVariables,
  parseVariableDefinitions,
  type VariableOption
} from '~~/shared/utils/query-variables'

type AdminVariableControl = {
  name: string
  label: string
  inputType: 'text' | 'number' | 'select' | 'date_range'
  defaultValue?: string
  options: VariableOption[]
  dateRangeConfig?: {
    minYear?: number
    maxYear?: number
  }
}

const toTitleLabel = (name: string) =>
  name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const mapQueryListOptions = (
  rows: Record<string, unknown>[],
  valueColumn: string,
  labelColumn: string
) => {
  const options: VariableOption[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const valueRaw = row[valueColumn]
    if (valueRaw === undefined || valueRaw === null) {
      continue
    }

    const value = String(valueRaw)
    if (seen.has(value)) {
      continue
    }

    const labelRaw = row[labelColumn]
    const label = labelRaw === undefined || labelRaw === null ? value : String(labelRaw)
    options.push({ value, label })
    seen.add(value)
  }

  return options
}

const parseSourceQueryParameters = (query: Record<string, unknown>) => {
  const parameters: Record<string, unknown> = {}

  for (const [key, rawValue] of Object.entries(query)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (value === undefined || value === null) {
      continue
    }
    if (typeof value === 'string' && !value.trim()) {
      continue
    }

    parameters[key] = value
  }

  return parameters
}

export default defineEventHandler(async (event) => {
  const dashboardId = getRouterParam(event, 'id')
  const moduleId = getRouterParam(event, 'moduleId')
  if (!dashboardId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard id' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }

  const modules = await listModules(dashboardId)
  const module = modules.find((item) => item.id === moduleId)
  if (!module) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }

  const savedQueryId = module.queryVisualizationQueryId?.trim() ?? ''
  if (!savedQueryId) {
    return { variables: [] as AdminVariableControl[] }
  }

  const savedQuery = await getSavedQueryById(savedQueryId)
  const configuredDefinitions = parseVariableDefinitions(savedQuery.parameters ?? {})
  const fallbackDefinitions = extractVariables(savedQuery.queryText).map((name) => ({
    name,
    type: 'text' as const
  }))
  const definitions = configuredDefinitions.length ? configuredDefinitions : fallbackDefinitions
  const sourceQueryParameters = parseSourceQueryParameters(getQuery(event) as Record<string, unknown>)
  const variables: AdminVariableControl[] = []

  for (const definition of definitions) {
    if (definition.type === 'date_range') {
      const defaultFrom = definition.dateRangeConfig?.defaultFrom
      const defaultTo = definition.dateRangeConfig?.defaultTo

      variables.push({
        name: definition.name,
        label: definition.label?.trim() || toTitleLabel(definition.name),
        inputType: 'date_range',
        defaultValue: defaultFrom && defaultTo ? `${defaultFrom}|${defaultTo}` : undefined,
        options: [],
        dateRangeConfig: {
          minYear: definition.dateRangeConfig?.minYear,
          maxYear: definition.dateRangeConfig?.maxYear
        }
      })
      continue
    }

    if (definition.type === 'select') {
      variables.push({
        name: definition.name,
        label: definition.label?.trim() || toTitleLabel(definition.name),
        inputType: 'select',
        defaultValue:
          definition.defaultValue === undefined || definition.defaultValue === null
            ? undefined
            : String(definition.defaultValue),
        options: definition.options ?? []
      })
      continue
    }

    if (definition.type === 'number' || definition.type === 'text' || !definition.type) {
      variables.push({
        name: definition.name,
        label: definition.label?.trim() || toTitleLabel(definition.name),
        inputType: definition.type === 'number' ? 'number' : 'text',
        defaultValue:
          definition.defaultValue === undefined || definition.defaultValue === null
            ? undefined
            : String(definition.defaultValue),
        options: []
      })
      continue
    }

    if (definition.type !== 'query_list' || !definition.sourceQueryId) {
      continue
    }

    try {
      const sourceResult = await runSavedQueryById({
        savedQueryId: definition.sourceQueryId,
        parameters: sourceQueryParameters,
        limit: 100
      })
      const fallbackColumn = sourceResult.columns[0]
      const valueColumn = definition.valueColumn || fallbackColumn || ''
      const labelColumn = definition.labelColumn || valueColumn
      if (!valueColumn) {
        continue
      }

      variables.push({
        name: definition.name,
        label: definition.label?.trim() || toTitleLabel(definition.name),
        inputType: 'select',
        defaultValue:
          definition.defaultValue === undefined || definition.defaultValue === null
            ? undefined
            : String(definition.defaultValue),
        options: mapQueryListOptions(sourceResult.rows, valueColumn, labelColumn)
      })
    } catch {
      variables.push({
        name: definition.name,
        label: definition.label?.trim() || toTitleLabel(definition.name),
        inputType: 'select',
        defaultValue:
          definition.defaultValue === undefined || definition.defaultValue === null
            ? undefined
            : String(definition.defaultValue),
        options: []
      })
    }
  }

  return { variables }
})
