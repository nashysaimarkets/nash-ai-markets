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
