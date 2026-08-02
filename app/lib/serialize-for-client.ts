/**
 * Next.js Flight/RSC rejects NaN and Infinity in client props.
 * Mirror Terminal: replace non-finite numbers before crossing the boundary.
 */
export function sanitizeForClient<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (typeof current === "number" && !Number.isFinite(current)) return null;
      return current;
    }),
  ) as T;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
