import path from 'node:path'
import { createError } from 'h3'

export const getOpenbaseDataDir = () =>
  path.resolve(process.env.OPENBASE_DATA_DIR || process.cwd())

export const resolveDataFilePath = (
  filepath: string,
  options?: {
    allowMemory?: boolean
  }
) => {
  const raw = filepath.trim()
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'File path is required' })
  }

  if (options?.allowMemory && raw === ':memory:') {
    return raw
  }

  const dataDir = getOpenbaseDataDir()
  const resolved = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(dataDir, raw)

  if (resolved === dataDir || resolved.startsWith(`${dataDir}${path.sep}`)) {
    return resolved
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'File path must be within OPENBASE_DATA_DIR'
  })
}
