import { randomUUID } from 'crypto'
import { createError } from 'h3'
import type { Dashboard, DashboardInput, DashboardUpdate } from '~/types/dashboard'
import type { ModuleConfig, ModuleInput, ModuleLayoutUpdate, ModuleUpdate } from '~/types/module'

type DashboardStore = {
  dashboards: Map<string, Dashboard>
  modules: Map<string, ModuleConfig[]>
}

const storeKey = '__openbaseDashboardStore'

const getStore = (): DashboardStore => {
  const global = globalThis as typeof globalThis & {
    [storeKey]?: DashboardStore
  }

  if (!global[storeKey]) {
    global[storeKey] = { dashboards: new Map(), modules: new Map() }
  }

  return global[storeKey]
}

const generateToken = () => randomUUID().replace(/-/g, '')

const createDefaultModules = (dashboardId: string): ModuleConfig[] => [
  {
    id: randomUUID(),
    dashboardId,
    type: 'kpi_card',
    title: 'KPI Card',
    config: {},
    gridX: 0,
    gridY: 0,
    gridW: 6,
    gridH: 4
  }
]

export const listDashboards = (): Dashboard[] => {
  return Array.from(getStore().dashboards.values())
}

export const getDashboardById = (id: string): Dashboard => {
  const dashboard = getStore().dashboards.get(id)
  if (!dashboard) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  return dashboard
}

export const getDashboardBySlug = (slug: string): Dashboard => {
  const dashboard = listDashboards().find((item) => item.slug === slug)
  if (!dashboard) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  return dashboard
}

const ensureSlugUnique = (slug: string, currentId?: string) => {
  const existing = listDashboards().find(
    (item) => item.slug === slug && item.id !== currentId
  )
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
  }
}

export const createDashboard = (input: DashboardInput): Dashboard => {
  ensureSlugUnique(input.slug)
  const now = new Date().toISOString()
  const dashboard: Dashboard = {
    id: randomUUID(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    tags: input.tags ?? [],
    shareToken: generateToken(),
    createdAt: now,
    updatedAt: now
  }

  const store = getStore()
  store.dashboards.set(dashboard.id, dashboard)
  store.modules.set(dashboard.id, createDefaultModules(dashboard.id))
  return dashboard
}

export const updateDashboard = (
  id: string,
  updates: DashboardUpdate
): Dashboard => {
  const existing = getDashboardById(id)

  if (updates.slug) {
    ensureSlugUnique(updates.slug, id)
  }

  const updated: Dashboard = {
    ...existing,
    ...updates,
    tags: updates.tags ?? existing.tags,
    updatedAt: new Date().toISOString()
  }

  getStore().dashboards.set(id, updated)
  return updated
}

export const deleteDashboard = (id: string) => {
  const store = getStore()
  if (!store.dashboards.delete(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  store.modules.delete(id)
}

export const rotateDashboardToken = (id: string): Dashboard => {
  const existing = getDashboardById(id)
  const updated: Dashboard = {
    ...existing,
    shareToken: generateToken(),
    updatedAt: new Date().toISOString()
  }
  getStore().dashboards.set(id, updated)
  return updated
}

export const listModules = (dashboardId: string): ModuleConfig[] => {
  getDashboardById(dashboardId)
  return getStore().modules.get(dashboardId) ?? []
}

export const createModule = (dashboardId: string, input: ModuleInput): ModuleConfig => {
  getDashboardById(dashboardId)
  const module: ModuleConfig = {
    id: randomUUID(),
    dashboardId,
    type: input.type,
    title: input.title,
    config: input.config ?? {},
    gridX: input.gridX ?? 0,
    gridY: input.gridY ?? 0,
    gridW: input.gridW ?? 6,
    gridH: input.gridH ?? 4
  }
  const modules = listModules(dashboardId)
  modules.push(module)
  getStore().modules.set(dashboardId, modules)
  return module
}

const findModule = (moduleId: string) => {
  const store = getStore()
  for (const [dashboardId, modules] of store.modules.entries()) {
    const index = modules.findIndex((item) => item.id === moduleId)
    if (index >= 0) {
      return { dashboardId, modules, index }
    }
  }
  throw createError({ statusCode: 404, statusMessage: 'Module not found' })
}

export const updateModule = (moduleId: string, updates: ModuleUpdate): ModuleConfig => {
  const match = findModule(moduleId)
  const existing = match.modules[match.index]
  const updated: ModuleConfig = {
    ...existing,
    ...updates,
    config: updates.config ?? existing.config
  }
  match.modules.splice(match.index, 1, updated)
  getStore().modules.set(match.dashboardId, match.modules)
  return updated
}

export const deleteModule = (moduleId: string) => {
  const match = findModule(moduleId)
  match.modules.splice(match.index, 1)
  getStore().modules.set(match.dashboardId, match.modules)
}

export const updateModuleLayout = (
  dashboardId: string,
  layout: ModuleLayoutUpdate[]
) => {
  const modules = listModules(dashboardId)
  const updatesById = new Map(layout.map((item) => [item.id, item]))
  const updated = modules.map((module) => {
    const update = updatesById.get(module.id)
    if (!update) {
      return module
    }
    return {
      ...module,
      gridX: update.gridX,
      gridY: update.gridY,
      gridW: update.gridW,
      gridH: update.gridH
    }
  })
  getStore().modules.set(dashboardId, updated)
  return updated
}
