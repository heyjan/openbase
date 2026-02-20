import { Pool } from 'pg'

let pool: Pool | null = null

export const getDb = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured')
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

export const query = async <T = unknown>(text: string, params?: unknown[]) => {
  const client = getDb()
  const result = await client.query<T>(text, params)
  return result
}
