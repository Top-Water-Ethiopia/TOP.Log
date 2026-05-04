// Simple in-memory cache for permissions (in production, use Redis)
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()

export async function getCacheValue<T>(key: string): Promise<T | undefined> {
  const item = cache.get(key)
  if (!item) return undefined // Use undefined to distinguish from null cache hits

  const now = Date.now()
  if (now - item.timestamp > item.ttl) {
    cache.delete(key)
    return undefined
  }

  return item.data as T
}

export async function setCacheValue<T>(key: string, data: T, ttlMs: number = 300000): Promise<void> {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  })
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear()
    return
  }

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  }
}
