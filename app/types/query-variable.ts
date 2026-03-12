export type SelectorMode = 'admin' | 'shared'

export type QueryVariableInputType = 'text' | 'number' | 'select' | 'date_range'

export interface QueryVariableOption {
  label: string
  value: string
}

export interface QueryVariable {
  name: string
  label: string
  inputType: QueryVariableInputType
  options: QueryVariableOption[]
  defaultValue?: string
  dateRangeConfig?: {
    minYear?: number
    maxYear?: number
  }
}

export type QueryVariableValues = Record<string, string>
