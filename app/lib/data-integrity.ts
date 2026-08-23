/**
 * Quarantine mathematically inconsistent market fields without inventing replacements.
 */

export type DataIntegrityIssue = {
  field: string;
  reason: string;
};

export type CandleIntegrityInput = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export function validateCandleIntegrity(
  candles: readonly CandleIntegrityInput[],
  nowSec = Math.floor(Date.now() / 1000),
  clockToleranceSec = 120,
): { accepted: CandleIntegrityInput[]; issues: DataIntegrityIssue[] } {
  const accepted: CandleIntegrityInput[] = [];
  const issues: DataIntegrityIssue[] = [];

  for (const [index, candle] of candles.entries()) {
    const path = `candles[${index}]`;
    if (![candle.open, candle.high, candle.low, candle.close, candle.time].every(Number.isFinite)) {
      issues.push({ field: path, reason: "Non-finite OHLC or timestamp" });
      continue;
    }
    if (candle.high < candle.low) {
      issues.push({ field: path, reason: "High below low" });
      continue;
    }
    if (candle.close > candle.high || candle.close < candle.low || candle.open > candle.high || candle.open < candle.low) {
      issues.push({ field: path, reason: "Open/close outside high/low range" });
      continue;
    }
    if (candle.time > nowSec + clockToleranceSec) {
      issues.push({ field: path, reason: "Timestamp ahead of clock tolerance" });
      continue;
    }
    accepted.push(candle);
  }

  return { accepted, issues };
}

export function validatePercentChange(
  absoluteChange: number,
  referenceClose: number,
  reportedPercent: number,
  tolerance = 0.05,
): DataIntegrityIssue | null {
  if (![absoluteChange, referenceClose, reportedPercent].every(Number.isFinite)) {
    return { field: "percentChange", reason: "Non-finite percent inputs" };
  }
  if (referenceClose === 0) {
    return { field: "percentChange", reason: "Reference close is zero" };
  }
  const expected = (absoluteChange / Math.abs(referenceClose)) * 100;
  if (Math.abs(expected - reportedPercent) > tolerance) {
    return {
      field: "percentChange",
      reason: `Reported ${reportedPercent} disagrees with ${expected.toFixed(4)} from absolute change`,
    };
  }
  return null;
}

export function validateUpcomingCatalyst(
  startsAt: string,
  nowMs = Date.now(),
): DataIntegrityIssue | null {
  const ms = Date.parse(startsAt);
  if (!Number.isFinite(ms)) return { field: "catalyst.at", reason: "Invalid catalyst timestamp" };
  if (ms <= nowMs) return { field: "catalyst.at", reason: "Catalyst is not in the future" };
  return null;
}

export function validateSymbolIdentity(input: {
  symbol: string;
  displayName: string;
}): DataIntegrityIssue | null {
  const symbol = input.symbol.toUpperCase();
  const name = input.displayName.toLowerCase();
  if ((symbol === "IXIC" || symbol === "^IXIC") && /nasdaq-?100|nq futures|\bnq\b/.test(name)) {
    return { field: "symbol", reason: "Nasdaq Composite must not be labelled as Nasdaq-100 futures" };
  }
  if (symbol === "ES" && /\bspx\b|cash s&p|spot s&p/.test(name)) {
    return { field: "symbol", reason: "ES must not be described as cash SPX" };
  }
  return null;
}
