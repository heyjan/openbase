import type { ModuleType } from '~/types/module'

export type ModuleTemplate = {
  id: string
  name: string
  type: ModuleType
  config: Record<string, unknown>
  createdAt: string
}

export type ModuleTemplateInput = {
  name: string
  type: ModuleType
  config: Record<string, unknown>
}
