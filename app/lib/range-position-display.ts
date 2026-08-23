/**
 * Presentation helper for verified 24-hour range position.
 * Does not alter OHLC/EMA/decision calculations — display semantics only.
 */

export type RangePositionDisplay = {
  /** Clamped 0–100 for bar fill / marker placement. */
  displayPct: number | null;
  /** Unclamped percentage; may be &lt;0 or &gt;100 when quote sits outside the verified range. */
  rawPct: number | null;
  outside: "above" | "below" | null;
  note: string | null;
};

export function describeRangePosition(
  current: number,
  low: number,
  high: number,
): RangePositionDisplay {
  if (!Number.isFinite(current) || !Number.isFinite(low) || !Number.isFinite(high) || !(high > low)) {
    return { displayPct: null, rawPct: null, outside: null, note: null };
  }

  const rawPct = ((current - low) / (high - low)) * 100;
  if (rawPct > 100) {
    return {
      displayPct: 100,
      rawPct,
      outside: "above",
      note: "Current quote sits above the verified 24-hour high — the marker stays at the top edge.",
    };
  }
  if (rawPct < 0) {
    return {
      displayPct: 0,
      rawPct,
      outside: "below",
      note: "Current quote sits below the verified 24-hour low — the marker stays at the bottom edge.",
    };
  }
  return {
    displayPct: Math.round(rawPct),
    rawPct,
    outside: null,
    note: null,
  };
}
