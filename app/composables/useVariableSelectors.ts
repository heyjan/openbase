import type { Ref } from 'vue'
import type {
  QueryVariable,
  QueryVariableValues,
  SelectorMode
} from '~/types/query-variable'

const resolveDefaultValue = (variable: QueryVariable) => {
  if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
    const defaultValue = String(variable.defaultValue)
    if (
      variable.inputType === 'select' &&
      variable.options.length &&
      !variable.options.some((option) => option.value === defaultValue)
    ) {
      return variable.options[0]?.value ?? ''
    }
    return defaultValue
  }

  if (variable.inputType === 'select') {
    return variable.options[0]?.value ?? ''
  }

  return ''
}

const resolveCurrentValue = (
  variable: QueryVariable,
  candidate: string | undefined
) => {
  const value = candidate ?? ''
  if (!value) {
    return resolveDefaultValue(variable)
  }

  if (
    variable.inputType === 'select' &&
    variable.options.length &&
    !variable.options.some((option) => option.value === value)
  ) {
    return resolveDefaultValue(variable)
  }

  return value
}

export const useVariableSelectors = (options: {
  mode: SelectorMode
  variables: Ref<QueryVariable[]>
  routeQuery: Ref<Record<string, string>>
}) => {
  const route = useRoute()
  const router = useRouter()
  const localValues = ref<QueryVariableValues>({})

  const currentValues = computed<QueryVariableValues>(() => {
    const next: QueryVariableValues = {}

    for (const variable of options.variables.value) {
      const sourceValue =
        options.mode === 'shared'
          ? options.routeQuery.value[variable.name]
          : localValues.value[variable.name]
      next[variable.name] = resolveCurrentValue(variable, sourceValue)
    }

    return next
  })

  const setSharedQueryValues = (values: QueryVariableValues) => {
    if (!process.client) {
      return
    }

    const nextQuery: Record<string, string> = { ...options.routeQuery.value }

    for (const variable of options.variables.value) {
      const value = values[variable.name] ?? ''
      if (value) {
        nextQuery[variable.name] = value
        continue
      }
      delete nextQuery[variable.name]
    }

    void router.replace({
      path: route.path,
      query: nextQuery
    })
  }

  const updateValue = (name: string, value: string) => {
    if (options.mode === 'shared') {
      setSharedQueryValues({
        ...currentValues.value,
        [name]: value
      })
      return
    }

    localValues.value = {
      ...localValues.value,
      [name]: value
    }
  }

  const resetToDefaults = () => {
    const defaults: QueryVariableValues = {}
    for (const variable of options.variables.value) {
      defaults[variable.name] = resolveDefaultValue(variable)
    }

    if (options.mode === 'shared') {
      setSharedQueryValues(defaults)
      return
    }

    localValues.value = defaults
  }

  watch(
    () => options.variables.value.map((variable) => variable.name).join('|'),
    () => {
      const allowedNames = new Set(options.variables.value.map((variable) => variable.name))
      const pruned: QueryVariableValues = {}
      for (const [name, value] of Object.entries(localValues.value)) {
        if (allowedNames.has(name)) {
          pruned[name] = value
        }
      }
      localValues.value = pruned
    },
    { immediate: true }
  )

  return {
    currentValues,
    updateValue,
    resetToDefaults
  }
}
