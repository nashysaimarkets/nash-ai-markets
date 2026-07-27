/**
 * Shared freshness / age labels.
 * Use explicit labels when multiple ages appear on one screen.
 */

export type FreshnessKind =
  | "snapshot"
  | "candle"
  | "provider"
  | "analysis";

const KIND_PREFIX: Record<FreshnessKind, string> = {
  snapshot: "Snapshot age",
  candle: "Latest candle age",
  provider: "Provider verification age",
  analysis: "Derived-analysis age",
};

/** Compact relative age from an ISO timestamp (e.g. "12m old"). */
export function formatRelativeAge(isoTimestamp: string, now = Date.now()): string {
  const timestamp = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(timestamp)) return "age unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
}

/** Compact relative age from a millisecond duration. */
export function formatAgeFromMs(ageMs: number | null | undefined): string {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return "age unavailable";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
}

/** Explicit labelled age for UI surfaces that show more than one clock. */
export function formatFreshnessLabel(
  kind: FreshnessKind,
  isoOrMs: string | number | null | undefined,
  now = Date.now(),
): string {
  const age = typeof isoOrMs === "number"
    ? formatAgeFromMs(isoOrMs)
    : typeof isoOrMs === "string"
      ? formatRelativeAge(isoOrMs, now)
      : "age unavailable";
  return `${KIND_PREFIX[kind]}: ${age}`;
}
