import type { MaybeRef } from 'vue'
import {
  extractVariables,
  parseVariableDefinitions,
  type VariableDefinition,
  type VariableOption
} from '~~/shared/utils/query-variables'

export type QueryVariableDefinitionControl = {
  name: string
  label: string
  inputType: 'text' | 'number' | 'select' | 'date_range'
  sourceType: VariableDefinition['type'] | 'text'
  required: boolean
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

const sanitizeRuntimeParameters = (parameters: Record<string, unknown>) => {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) {
      continue
    }
    if (typeof value === 'string' && !value.trim()) {
      continue
    }
    next[key] = value
  }
  return next
}

const toSignature = (value: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  )

const toDefaultValue = (value: string | number | null | undefined) =>
  value === undefined || value === null ? undefined : String(value)

export const useQueryVariableDefinitions = (
  savedQueryId: MaybeRef<string | undefined>,
  runtimeParameters: MaybeRef<Record<string, unknown>> = {}
) => {
  const { getById, preview } = useQueries()
  const variables = ref<QueryVariableDefinitionControl[]>([])
  const loading = ref(false)
  const error = ref('')
  let requestSeq = 0

  const savedQueryIdRef = computed(() => unref(savedQueryId)?.trim() ?? '')
  const runtimeParametersRef = computed(() =>
    sanitizeRuntimeParameters(unref(runtimeParameters) ?? {})
  )
  const runtimeParametersSignature = computed(() =>
    toSignature(runtimeParametersRef.value)
  )

  const load = async () => {
    const requestId = ++requestSeq
    const queryId = savedQueryIdRef.value

    if (!queryId) {
      variables.value = []
      loading.value = false
      error.value = ''
      return
    }

    loading.value = true
    error.value = ''

    try {
      const query = await getById(queryId)
      const configuredDefinitions = parseVariableDefinitions(query.parameters ?? {})
      const fallbackDefinitions: VariableDefinition[] = extractVariables(query.queryText).map(
        (name): VariableDefinition => ({
          name,
          type: 'text',
          required: false
        })
      )
      const definitions = configuredDefinitions.length ? configuredDefinitions : fallbackDefinitions
      const nextVariables: QueryVariableDefinitionControl[] = []

      for (const definition of definitions) {
        const label = definition.label?.trim() || toTitleLabel(definition.name)
        const defaultValue = toDefaultValue(definition.defaultValue)

        if (definition.type === 'date_range') {
          const defaultFrom = definition.dateRangeConfig?.defaultFrom
          const defaultTo = definition.dateRangeConfig?.defaultTo

          nextVariables.push({
            name: definition.name,
            label,
            inputType: 'date_range',
            sourceType: 'date_range',
            required: definition.required === true,
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
          nextVariables.push({
            name: definition.name,
            label,
            inputType: 'select',
            sourceType: 'select',
            required: definition.required === true,
            defaultValue,
            options: definition.options ?? []
          })
          continue
        }

        if (definition.type === 'number' || definition.type === 'text' || !definition.type) {
          nextVariables.push({
            name: definition.name,
            label,
            inputType: definition.type === 'number' ? 'number' : 'text',
            sourceType: definition.type === 'number' ? 'number' : 'text',
            required: definition.required === true,
            defaultValue,
            options: []
          })
          continue
        }

        if (definition.type !== 'query_list' || !definition.sourceQueryId) {
          nextVariables.push({
            name: definition.name,
            label,
            inputType: 'select',
            sourceType: 'query_list',
            required: definition.required === true,
            defaultValue,
            options: []
          })
          continue
        }

        try {
          const sourceResult = await preview(definition.sourceQueryId, {
            limit: 100,
            parameters: runtimeParametersRef.value
          })
          const fallbackColumn = sourceResult.columns[0]
          const valueColumn = definition.valueColumn || fallbackColumn || ''
          const labelColumn = definition.labelColumn || valueColumn

          nextVariables.push({
            name: definition.name,
            label,
            inputType: 'select',
            sourceType: 'query_list',
            required: definition.required === true,
            defaultValue,
            options: valueColumn
              ? mapQueryListOptions(sourceResult.rows, valueColumn, labelColumn)
              : []
          })
        } catch {
          nextVariables.push({
            name: definition.name,
            label,
            inputType: 'select',
            sourceType: 'query_list',
            required: definition.required === true,
            defaultValue,
            options: []
          })
        }
      }

      if (requestId !== requestSeq) {
        return
      }

      variables.value = nextVariables
    } catch (loadError) {
      if (requestId !== requestSeq) {
        return
      }

      error.value =
        loadError instanceof Error ? loadError.message : 'Failed to load query variable definitions'
      variables.value = []
    } finally {
      if (requestId === requestSeq) {
        loading.value = false
      }
    }
  }

  watch(
    [
      () => savedQueryIdRef.value,
      () => runtimeParametersSignature.value
    ],
    () => {
      void load()
    },
    { immediate: true }
  )

  return {
    variables,
    loading,
    error,
    refresh: load
  }
}
