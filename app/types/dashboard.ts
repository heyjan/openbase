export type CanvasWidthMode = 'fixed' | 'full'

export interface DashboardGridConfig {
  canvasWidthMode?: CanvasWidthMode
}

export interface Dashboard {
  id: string
  name: string
  slug: string
  description?: string
  tags?: string[]
  gridConfig?: DashboardGridConfig
  shareToken?: string
  createdAt: string
  updatedAt: string
}

export interface DashboardInput {
  name: string
  slug: string
  description?: string
  tags?: string[]
  gridConfig?: DashboardGridConfig
}

export interface DashboardUpdate {
  name?: string
  slug?: string
  description?: string
  tags?: string[]
  gridConfig?: DashboardGridConfig
}
