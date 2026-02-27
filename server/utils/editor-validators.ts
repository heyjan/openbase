import { createError } from 'h3'

const parseEmail = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }
  const email = value.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return ''
  }
  return email
}

const parseName = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const parseIdArray = (value: unknown, fieldName: string) => {
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be an array` })
  }

  const ids = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)

  return Array.from(new Set(ids))
}

export const parseEditorCreateInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const email = parseEmail(record.email)
  const name = parseName(record.name) || email
  const password = typeof record.password === 'string' ? record.password : ''

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Valid email required' })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  }

  return {
    email,
    name,
    password,
    isActive: typeof record.is_active === 'boolean' ? record.is_active : true
  }
}

export const parseEditorUpdateInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  const updates: {
    email?: string
    name?: string
    is_active?: boolean
    password?: string
  } = {}

  if (record.email !== undefined) {
    const email = parseEmail(record.email)
    if (!email) {
      throw createError({ statusCode: 400, statusMessage: 'Valid email required' })
    }
    updates.email = email
  }

  if (record.name !== undefined) {
    const name = parseName(record.name)
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    }
    updates.name = name
  }

  if (record.is_active !== undefined) {
    if (typeof record.is_active !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid is_active value' })
    }
    updates.is_active = record.is_active
  }

  if (record.password !== undefined) {
    if (typeof record.password !== 'string' || !record.password) {
      throw createError({ statusCode: 400, statusMessage: 'Password is required' })
    }
    updates.password = record.password
  }

  return updates
}

export const parseEditorPermissionsUpdate = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = value as Record<string, unknown>
  return {
    dashboardIds: parseIdArray(record.dashboardIds ?? record.dashboard_ids ?? [], 'dashboardIds'),
    writableTableIds: parseIdArray(
      record.writableTableIds ?? record.writable_table_ids ?? [],
      'writableTableIds'
    )
  }
}
