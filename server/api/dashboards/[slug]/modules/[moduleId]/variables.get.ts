import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { listModules } from '~~/server/utils/dashboard-store'
import { getSavedQueryById } from '~~/server/utils/query-store'
import { runSavedQueryById } from '~~/server/utils/query-runner'
import {
  extractVariables,
  parseVariableDefinitions,
  type VariableOption
} from '~~/shared/utils/query-variables'
import { requireSharedDashboardAccess } from '~~/server/utils/share-access'

type PublicVariableControl = {
  name: string
  label: string
  inputType: 'text' | 'number' | 'select'
  defaultValue?: string
  options: VariableOption[]
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

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const moduleId = getRouterParam(event, 'moduleId')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module id' })
  }

  const query = getQuery(event)
  const token = query.token
  if (!token || Array.isArray(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing share token' })
  }

  const { dashboard } = await requireSharedDashboardAccess(slug, token)

  const modules = await listModules(dashboard.id)
  const module = modules.find((item) => item.id === moduleId)
  if (!module) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }

  const savedQueryId = module.queryVisualizationQueryId?.trim() ?? ''
  if (!savedQueryId) {
    return { variables: [] as PublicVariableControl[] }
  }

  const savedQuery = await getSavedQueryById(savedQueryId)
  const configuredDefinitions = parseVariableDefinitions(savedQuery.parameters ?? {})
  const fallbackDefinitions = extractVariables(savedQuery.queryText).map((name) => ({
    name,
    type: 'text' as const
  }))
  const definitions = configuredDefinitions.length ? configuredDefinitions : fallbackDefinitions
  const variables: PublicVariableControl[] = []

  for (const definition of definitions) {
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
        parameters: {},
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
