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

  return {
    async get(loader: () => Promise<Value>): Promise<Value> {
      const currentTime = now();
      if (cached && cached.expiresAt > currentTime) return cached.value;
      if (inFlight) return inFlight;

      inFlight = loader().then((value) => {
        const duration = isFailure(value) ? failureTtlMs : ttlMs;
        cached = duration > 0 ? { value, expiresAt: now() + duration } : null;
        return value;
      }).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    clear() {
      cached = null;
      inFlight = null;
    },
  };
}

export function createAsyncKeyedTtlCache<Value>({
  ttlMs,
  maxEntries = 20,
  isFailure = () => false,
  now = Date.now,
}: AsyncTtlCacheOptions<Value> & { maxEntries?: number }) {
  const cached = new Map<string, CacheEntry<Value>>();
  const inFlight = new Map<string, Promise<Value>>();

  return {
    async get(key: string, loader: () => Promise<Value>): Promise<Value> {
      const currentTime = now();
      const existing = cached.get(key);
      if (existing && existing.expiresAt > currentTime) return existing.value;
      cached.delete(key);
      const pending = inFlight.get(key);
      if (pending) return pending;

      const request = loader().then((value) => {
        if (!isFailure(value)) {
          cached.set(key, { value, expiresAt: now() + ttlMs });
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
    clear() {
      cached.clear();
      inFlight.clear();
    },
  };
}
