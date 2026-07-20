type CacheEntry<Value> = {
  expiresAt: number;
  value: Value;
};

type AsyncTtlCacheOptions<Value> = {
  ttlMs: number;
  failureTtlMs?: number;
  isFailure?: (value: Value) => boolean;
  now?: () => number;
};

export type AsyncCacheResult<Value> = {
  value: Value;
  status: "hit" | "miss" | "coalesced";
};

export type AsyncCacheStats = {
  hits: number;
  misses: number;
  coalesced: number;
  loads: number;
  stores: number;
  failureResults: number;
};

function emptyStats(): AsyncCacheStats {
  return { hits: 0, misses: 0, coalesced: 0, loads: 0, stores: 0, failureResults: 0 };
}

/**
 * Small per-instance cache for non-user-specific server reads.
 * Concurrent callers share one promise, preventing request bursts at expiry.
 */
export function createAsyncTtlCache<Value>({
  ttlMs,
  failureTtlMs = 0,
  isFailure = () => false,
  now = Date.now,
}: AsyncTtlCacheOptions<Value>) {
  let cached: CacheEntry<Value> | null = null;
  let inFlight: Promise<Value> | null = null;
  const stats = emptyStats();

  const cache = {
    async getWithStatus(loader: () => Promise<Value>): Promise<AsyncCacheResult<Value>> {
      const currentTime = now();
      if (cached && cached.expiresAt > currentTime) {
        stats.hits += 1;
        return { value: cached.value, status: "hit" };
      }
      if (inFlight) {
        stats.coalesced += 1;
        return { value: await inFlight, status: "coalesced" };
      }

      stats.misses += 1;
      stats.loads += 1;
      inFlight = loader().then((value) => {
        const failed = isFailure(value);
        if (failed) stats.failureResults += 1;
        const duration = failed ? failureTtlMs : ttlMs;
        cached = duration > 0 ? { value, expiresAt: now() + duration } : null;
        if (cached) stats.stores += 1;
        return value;
      }).finally(() => {
        inFlight = null;
      });
      return { value: await inFlight, status: "miss" };
    },
    async get(loader: () => Promise<Value>): Promise<Value> {
      return (await cache.getWithStatus(loader)).value;
    },
    getStats(): AsyncCacheStats {
      return { ...stats };
    },
    clear() {
      cached = null;
      inFlight = null;
      Object.assign(stats, emptyStats());
    },
  };

  return cache;
}

export function createAsyncKeyedTtlCache<Value>({
  ttlMs,
  maxEntries = 20,
  isFailure = () => false,
  now = Date.now,
}: AsyncTtlCacheOptions<Value> & { maxEntries?: number }) {
  const cached = new Map<string, CacheEntry<Value>>();
  const inFlight = new Map<string, Promise<Value>>();
  const stats = emptyStats();

  return {
    async get(key: string, loader: () => Promise<Value>): Promise<Value> {
      const currentTime = now();
      const existing = cached.get(key);
      if (existing && existing.expiresAt > currentTime) {
        stats.hits += 1;
        return existing.value;
      }
      cached.delete(key);
      const pending = inFlight.get(key);
      if (pending) {
        stats.coalesced += 1;
        return pending;
      }

      stats.misses += 1;
      stats.loads += 1;
      const request = loader().then((value) => {
        if (isFailure(value)) {
          stats.failureResults += 1;
        } else {
          cached.set(key, { value, expiresAt: now() + ttlMs });
          stats.stores += 1;
          while (cached.size > maxEntries) {
            const oldestKey = cached.keys().next().value as string | undefined;
            if (oldestKey === undefined) break;
            cached.delete(oldestKey);
          }
        }
        return value;
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, request);
      return request;
    },
    getStats(): AsyncCacheStats & { entries: number } {
      return { ...stats, entries: cached.size };
    },
    clear() {
      cached.clear();
      inFlight.clear();
      Object.assign(stats, emptyStats());
    },
  };
}
