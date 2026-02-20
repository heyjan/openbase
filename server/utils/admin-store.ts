import { randomUUID } from 'crypto'
import { createError } from 'h3'
import { query, getDb } from './db'

export type AdminUser = {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

type AdminUserWithPassword = AdminUser & { password_hash: string }

export const getAdminCount = async () => {
  const result = await query<{ count: string }>('SELECT COUNT(*) FROM admin_users')
  return Number(result.rows[0]?.count ?? 0)
}

export const listAdmins = async (): Promise<AdminUser[]> => {
  const result = await query<AdminUser>(
    'SELECT id, email, name, is_active, created_at, last_login_at FROM admin_users ORDER BY created_at'
  )
  return result.rows
}

export const getAdminByEmail = async (
  email: string
): Promise<AdminUserWithPassword | null> => {
  const result = await query<AdminUserWithPassword>(
    'SELECT id, email, name, is_active, created_at, last_login_at, password_hash FROM admin_users WHERE email = $1',
    [email]
  )
  return result.rows[0] ?? null
}

export const getAdminById = async (id: string): Promise<AdminUser | null> => {
  const result = await query<AdminUser>(
    'SELECT id, email, name, is_active, created_at, last_login_at FROM admin_users WHERE id = $1',
    [id]
  )
  return result.rows[0] ?? null
}

export const createAdminUser = async (
  email: string,
  passwordHash: string,
  name: string
): Promise<AdminUser> => {
  const result = await query<AdminUser>(
    `INSERT INTO admin_users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, is_active, created_at, last_login_at`,
    [email, passwordHash, name]
  )
  return result.rows[0]
}

export const updateAdminUser = async (
  id: string,
  updates: Partial<Pick<AdminUser, 'email' | 'name' | 'is_active'>>,
  passwordHash?: string
): Promise<AdminUser> => {
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
  const result = await query<AdminUser>(
    `UPDATE admin_users
     SET ${fields.join(', ')}, last_login_at = last_login_at
     WHERE id = $${index}
     RETURNING id, email, name, is_active, created_at, last_login_at`,
    values
  )
  if (!result.rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  }
  return result.rows[0]
}

export const countActiveAdmins = async () => {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) FROM admin_users WHERE is_active = true'
  )
  return Number(result.rows[0]?.count ?? 0)
}

export const createSession = async (adminId: string, expiresAt: Date) => {
  const token = randomUUID().replace(/-/g, '')
  await query(
    'INSERT INTO admin_sessions (admin_user_id, session_token, expires_at) VALUES ($1, $2, $3)',
    [adminId, token, expiresAt.toISOString()]
  )
  return token
}

export const getAdminBySessionToken = async (
  token: string
): Promise<AdminUser | null> => {
  const result = await query<AdminUser>(
    `SELECT a.id, a.email, a.name, a.is_active, a.created_at, a.last_login_at
     FROM admin_sessions s
     JOIN admin_users a ON a.id = s.admin_user_id
     WHERE s.session_token = $1 AND s.expires_at > now() AND a.is_active = true`,
    [token]
  )
  return result.rows[0] ?? null
}

export const deleteSession = async (token: string) => {
  await query('DELETE FROM admin_sessions WHERE session_token = $1', [token])
}

export const updateLastLogin = async (adminId: string) => {
  await query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [
    adminId
  ])
}

export const createMagicLink = async (email: string, expiresAt: Date) => {
  const token = randomUUID().replace(/-/g, '')
  const result = await query<{ token: string; expires_at: string }>(
    `INSERT INTO admin_magic_links (email, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING token, expires_at`,
    [email, token, expiresAt.toISOString()]
  )
  return result.rows[0]
}

export const consumeMagicLink = async (token: string) => {
  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{ id: string; email: string }>(
      `SELECT id, email
       FROM admin_magic_links
       WHERE token = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [token]
    )
    const link = result.rows[0]
    if (!link) {
      throw createError({ statusCode: 400, statusMessage: 'Magic link invalid' })
    }
    await client.query('UPDATE admin_magic_links SET used_at = now() WHERE id = $1', [
      link.id
    ])
    await client.query('COMMIT')
    return link.email
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
