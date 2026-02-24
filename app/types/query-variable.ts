export type SelectorMode = 'admin' | 'shared'

export type QueryVariableInputType = 'text' | 'number' | 'select'

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
}

export type QueryVariableValues = Record<string, string>
