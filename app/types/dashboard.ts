export interface Dashboard {
  id: string
  name: string
  slug: string
  description?: string
  tags?: string[]
  shareToken: string
  createdAt: string
  updatedAt: string
}

export interface DashboardInput {
  name: string
  slug: string
  description?: string
  tags?: string[]
}

export interface DashboardUpdate {
  name?: string
  slug?: string
  description?: string
  tags?: string[]
}
