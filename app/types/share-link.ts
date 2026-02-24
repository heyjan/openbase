export interface ShareLink {
  id: string
  dashboardId: string
  token: string
  label: string | null
  isActive: boolean
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ShareLinkWithStats extends ShareLink {
  dashboardName: string
  dashboardSlug: string
}
