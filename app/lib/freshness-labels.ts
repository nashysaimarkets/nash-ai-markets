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

/**
 * Customer phrase for the newest verified candle age.
 * Derived only from candle `dataAgeMs` (or equivalent duration) — never from
 * a nominal provider delay window.
 */
export function formatVerifiedCandleAgePhrase(ageMs: number | null | undefined): string {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return "age unavailable";
  if (ageMs < 60_000) return "under 1 minute old";
  if (ageMs < 3_600_000) {
    const minutes = Math.floor(ageMs / 60_000);
    return minutes === 1 ? "1 minute old" : `${minutes} minutes old`;
  }
  if (ageMs < 86_400_000) {
    const hours = Math.floor(ageMs / 3_600_000);
    return hours === 1 ? "1 hour old" : `${hours} hours old`;
  }
  const days = Math.floor(ageMs / 86_400_000);
  return days === 1 ? "1 day old" : `${days} days old`;
}

/**
 * Authoritative customer-facing delayed-data line for the newest verified candle.
 * Prefer this over snapshot/gateway ages when a candle series is available.
 */
export function formatDelayedVerifiedCandleAgeDisplay(ageMs: number | null | undefined): string {
  const phrase = formatVerifiedCandleAgePhrase(ageMs);
  if (phrase === "age unavailable") {
    return "Delayed market data · latest verified candle age unavailable";
  }
  return `Delayed market data · latest verified candle ${phrase}`;
}

/**
 * Distinguishes an unavailable candle feed from one that was intentionally not
 * loaded for the current membership. This never presents quote age as candle age.
 */
export function formatMembershipAwareMarketDataDisplay(input: {
  candleAgeMs: number | null | undefined;
  candleAccess: boolean;
  quoteAvailable: boolean;
}): string {
  if (input.candleAccess) return formatDelayedVerifiedCandleAgeDisplay(input.candleAgeMs);
  return input.quoteAvailable
    ? "Delayed market quote · verified candle history requires Pro or Elite"
    : "Verified market quote unavailable · candle history requires Pro or Elite";
}

/**
 * Authoritative customer-facing delayed-data age line from a preformatted age string.
 * Prefer `formatDelayedVerifiedCandleAgeDisplay(dataAgeMs)` when candle age is known.
 */
export function formatDelayedDataAgeDisplay(ageLabel: string | null | undefined): string {
  const age = (ageLabel ?? "").trim();
  if (!age || /unavailable/i.test(age)) {
    return "Delayed market data · latest verified candle age unavailable";
  }
  if (/^delayed market data/i.test(age)) return age;
  const normalized = age
    .replace(/^latest verified candle\s+/i, "")
    .replace(/^latest candle age:\s*/i, "")
    .replace(/^snapshot age:\s*/i, "");
  if (/minutes? old|hours? old|days? old|under 1 minute old/i.test(normalized)) {
    return `Delayed market data · latest verified candle ${normalized}`;
  }
  // Compact forms such as "14m old" stay truthful but are expanded via callers when possible.
  return `Delayed market data · latest verified candle ${normalized}`;
}

/** Optional note for nominal provider delay — never substitute for candle age. */
export function formatNominalProviderDelayNote(minutes = 10): string {
  return `Nominal provider delay: approximately ${minutes} minutes`;
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
