import { randomUUID } from 'crypto'
import { createError } from 'h3'
import { query } from './db'

export type EditorUser = {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

type EditorUserWithPassword = EditorUser & { password_hash: string }

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

const toEditorConflict = (error: unknown) => {
  if (isUniqueViolation(error)) {
    throw createError({ statusCode: 409, statusMessage: 'Editor already exists' })
  }
  throw error
}

export const listEditors = async (): Promise<EditorUser[]> => {
  const result = await query<EditorUser>(
    'SELECT id, email, name, is_active, created_at, last_login_at FROM editor_users ORDER BY created_at'
  )
  return result.rows
}

export const getEditorById = async (id: string): Promise<EditorUser | null> => {
  const result = await query<EditorUser>(
    'SELECT id, email, name, is_active, created_at, last_login_at FROM editor_users WHERE id = $1',
    [id]
  )
  return result.rows[0] ?? null
}

export const getEditorByEmail = async (
  email: string
): Promise<EditorUserWithPassword | null> => {
  const result = await query<EditorUserWithPassword>(
    `SELECT id, email, name, is_active, created_at, last_login_at, password_hash
     FROM editor_users
     WHERE email = $1`,
    [email]
  )
  return result.rows[0] ?? null
}

export const createEditorUser = async (
  email: string,
  passwordHash: string,
  name: string,
  isActive = true
): Promise<EditorUser> => {
  try {
    const result = await query<EditorUser>(
      `INSERT INTO editor_users (email, password_hash, name, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, is_active, created_at, last_login_at`,
      [email, passwordHash, name, isActive]
    )
    return result.rows[0]
  } catch (error) {
    toEditorConflict(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to create editor' })
}

export const updateEditorUser = async (
  id: string,
  updates: Partial<Pick<EditorUser, 'email' | 'name' | 'is_active'>>,
  passwordHash?: string
): Promise<EditorUser> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.email !== undefined) {
    fields.push(`email = $${index++}`)
    values.push(updates.email)
  }
  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${index++}`)
    values.push(updates.is_active)
  }
  if (passwordHash) {
    fields.push(`password_hash = $${index++}`)
    values.push(passwordHash)
  }

  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'No updates provided' })
  }

  values.push(id)
  try {
    const result = await query<EditorUser>(
      `UPDATE editor_users
       SET ${fields.join(', ')}, last_login_at = last_login_at
       WHERE id = $${index}
       RETURNING id, email, name, is_active, created_at, last_login_at`,
      values
    )
    const editor = result.rows[0]
    if (!editor) {
      throw createError({ statusCode: 404, statusMessage: 'Editor not found' })
    }
    return editor
  } catch (error) {
    toEditorConflict(error)
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to update editor' })
}

export const createEditorSession = async (editorId: string, expiresAt: Date) => {
  const token = randomUUID().replace(/-/g, '')
  await query(
    `INSERT INTO editor_sessions (editor_user_id, session_token, expires_at)
     VALUES ($1, $2, $3)`,
    [editorId, token, expiresAt.toISOString()]
  )
  return token
}

export const getEditorBySessionToken = async (
  token: string
): Promise<EditorUser | null> => {
  const result = await query<EditorUser>(
    `SELECT e.id, e.email, e.name, e.is_active, e.created_at, e.last_login_at
     FROM editor_sessions s
     JOIN editor_users e ON e.id = s.editor_user_id
     WHERE s.session_token = $1 AND s.expires_at > now() AND e.is_active = true`,
    [token]
  )
  return result.rows[0] ?? null
}

export const deleteEditorSession = async (token: string) => {
  await query('DELETE FROM editor_sessions WHERE session_token = $1', [token])
}

export const updateEditorLastLogin = async (editorId: string) => {
  await query('UPDATE editor_users SET last_login_at = now() WHERE id = $1', [editorId])
}
