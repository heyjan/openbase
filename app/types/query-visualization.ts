import type { ModuleType } from '~/types/module'

export type QueryVisualization = {
  id: string
  savedQueryId: string
  savedQueryName?: string
  name: string
  moduleType: ModuleType
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type QueryVisualizationInput = {
  savedQueryId: string
  name: string
  moduleType: ModuleType
  config?: Record<string, unknown>
}
