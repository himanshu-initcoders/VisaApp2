/**
 * Process-local cache for public /api/media responses.
 * Avoids repeated S3 round-trips while Next Image Optimizer (and browsers)
 * warm the transformed /_next/image cache after deploy or revalidation.
 */

type CachedMedia = {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const cache = new Map<string, CachedMedia>();

function pruneExpired(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function enforceLimit() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getCachedPublicMedia(key: string): CachedMedia | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order for simple LRU eviction.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setCachedPublicMedia(
  key: string,
  buffer: Buffer,
  contentType: string,
  ttlMs = DEFAULT_TTL_MS
) {
  pruneExpired(Date.now());
  cache.set(key, {
    buffer,
    contentType,
    expiresAt: Date.now() + ttlMs,
  });
  enforceLimit();
}

export function invalidateCachedPublicMedia(key?: string) {
  if (!key) {
    cache.clear();
    return;
  }
  cache.delete(key);
}
