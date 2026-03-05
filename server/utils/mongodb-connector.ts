import { createError } from 'h3'
import { MongoClient } from 'mongodb'

type DataBrowserRowsOptions = {
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

const connectMongo = async (uri: string, database: string) => {
  if (!uri.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'MongoDB URI required' })
  }
  if (!database.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'MongoDB database required' })
  }
  const client = new MongoClient(uri)
  await client.connect()
  return { client, db: client.db(database) }
}

export const listMongoCollections = async (uri: string, database: string) => {
  const { client, db } = await connectMongo(uri, database)
  try {
    const collections = await db
      .listCollections({}, { nameOnly: true })
      .toArray()
    return collections
      .map((collection) => collection.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  } finally {
    await client.close()
  }
}

export const getMongoRows = async (
  uri: string,
  database: string,
  collection: string,
  limit = 50,
  options: DataBrowserRowsOptions = {}
) => {
  const { client, db } = await connectMongo(uri, database)
  try {
    const collections = await db
      .listCollections({ name: collection }, { nameOnly: true })
      .toArray()
    if (!collections.length) {
      throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 1000)) : 50
    const safeOffset =
      typeof options.offset === 'number' && Number.isFinite(options.offset)
        ? Math.max(0, Math.trunc(options.offset))
        : 0
    const sortColumn = options.sortBy?.trim()
    const sortOrder = options.sortDir === 'desc' ? -1 : 1

    if (sortColumn && (sortColumn.startsWith('$') || sortColumn.includes('\0'))) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sort column' })
    }

    const cursor = db.collection(collection).find({}).skip(safeOffset).limit(safeLimit)
    if (sortColumn) {
      cursor.sort({ [sortColumn]: sortOrder })
    }

    const docs = await cursor.toArray()
    const rows = docs.map((doc) => {
      const { _id, ...rest } = doc as Record<string, unknown>
      return {
        _id:
          _id && typeof _id === 'object' && 'toString' in _id
            ? (_id as { toString: () => string }).toString()
            : _id,
        ...rest
      }
    })
    const columns = rows.length
      ? Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
      : []
    return { columns, rows }
  } finally {
    await client.close()
  }
}

export const testMongoConnection = async (uri: string, database: string) => {
  const tables = await listMongoCollections(uri, database)
  return { ok: true, tables }
}

export const runMongoQuery = async (
  uri: string,
  database: string,
  collection: string,
  filter: Record<string, unknown>,
  limit: number
) => {
  const { client, db } = await connectMongo(uri, database)
  try {
    const collections = await db
      .listCollections({ name: collection }, { nameOnly: true })
      .toArray()
    if (!collections.length) {
      throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
    }
    const docs = await db
      .collection(collection)
      .find(filter, { limit })
      .toArray()
    const rows = docs.map((doc) => {
      const { _id, ...rest } = doc as Record<string, unknown>
      return {
        _id:
          _id && typeof _id === 'object' && 'toString' in _id
            ? (_id as { toString: () => string }).toString()
            : _id,
        ...rest
      }
    })
    const columns = rows.length
      ? Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
      : []
    return {
      rows,
      columns,
      rowCount: rows.length
    }
  } finally {
    await client.close()
  }
}
