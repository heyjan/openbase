type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetMs: number
}

const buckets = new Map<string, number[]>()

const pruneHits = (hits: number[], now: number, windowMs: number) => {
  const windowStart = now - windowMs
  return hits.filter((value) => value > windowStart)
}

export const consumeRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now()
  const existingHits = buckets.get(key) ?? []
  const hits = pruneHits(existingHits, now, windowMs)

  if (hits.length >= maxRequests) {
    const oldestHit = hits[0] ?? now
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(oldestHit + windowMs - now, 0)
    }
  }

  hits.push(now)
  buckets.set(key, hits)

  const oldestHit = hits[0] ?? now
  return {
    allowed: true,
    remaining: Math.max(maxRequests - hits.length, 0),
    resetMs: Math.max(oldestHit + windowMs - now, 0)
  }
}

export const getRateLimitStatus = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now()
  const existingHits = buckets.get(key) ?? []
  const hits = pruneHits(existingHits, now, windowMs)

  if (hits.length !== existingHits.length) {
    if (hits.length) {
      buckets.set(key, hits)
    } else {
      buckets.delete(key)
    }
  }

  const oldestHit = hits[0] ?? now
  return {
    allowed: hits.length < maxRequests,
    remaining: Math.max(maxRequests - hits.length, 0),
    resetMs: Math.max(oldestHit + windowMs - now, 0)
  }
}

export const resetRateLimit = (key: string) => {
  buckets.delete(key)
}
