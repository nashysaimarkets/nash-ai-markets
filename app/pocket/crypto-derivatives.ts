export type DerivativesRead = {
  symbol: string; readable: boolean; limitation: string;
  fundingRate: string; openInterestChange: string; longShortRatio: string;
  longLiquidations: string; shortLiquidations: string; period: string;
};
export type DerivativesResult = { status: "CONTEXT" | "UNVERIFIED"; symbol: string; message: string; observations: string[]; conflict: string };

export function isDerivativesResult(value: unknown, context?: Record<string, unknown>): value is DerivativesResult {
  if (!value || typeof value !== "object") return false;
  const result = value as DerivativesResult;
  return (result.status === "CONTEXT" || result.status === "UNVERIFIED") && typeof result.symbol === "string" && typeof result.message === "string" && typeof result.conflict === "string" &&
    Array.isArray(result.observations) && result.observations.length <= 5 && result.observations.every(item => typeof item === "string") &&
    (result.status === "CONTEXT" ? result.observations.length > 0 && (!context || typeof context.ticker === "string" && cryptoBase(result.symbol) !== null && cryptoBase(result.symbol) === cryptoBase(context.ticker)) : result.observations.length === 0);
}

export function cryptoBase(value: string): string | null {
  const normalized = value.trim().toUpperCase().replace(/^[A-Z0-9_-]+:/, "").replace(/[\s/_-]/g, "");
  const match = /^(BTC|ETH|SOL|XRP|BNB|DOGE|ADA)(?:USDT|USDC|USD|PERP)?$/.exec(normalized);
  return match?.[1] ?? null;
}

export function crossCheckDerivatives(read: DerivativesRead, ticker: string, structure: string): DerivativesResult {
  const base = cryptoBase(ticker);
  const empty = (message: string): DerivativesResult => ({ status: "UNVERIFIED", symbol: base ?? "", message, observations: [], conflict: "" });
  if (!base) return empty("This optional check requires a confirmed crypto spot or perpetual symbol.");
  if (!read.readable || cryptoBase(read.symbol) !== base) return empty(read.limitation || "The panel and chart cannot be confirmed as the same crypto asset.");
  const fields = [
    ["Funding", read.fundingRate], ["Open interest change", read.openInterestChange],
    ["Long/short ratio", read.longShortRatio], ["Long liquidations", read.longLiquidations],
    ["Short liquidations", read.shortLiquidations],
  ] as const;
  const observations = fields.filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value.trim().slice(0, 48)}`);
  if (!observations.length) return empty("No legible derivatives metric was found in the screenshot.");
  const lower = structure.toLowerCase();
  const uncertain = /\b(not|no|without|unclear|unconfirmed|potential|possible|may)\b/.test(lower);
  const up = !uncertain && /\b(uptrend|higher highs|higher lows|bullish)\b/.test(lower) && !/\b(downtrend|lower highs|lower lows|bearish)\b/.test(lower);
  const down = !uncertain && /\b(downtrend|lower highs|lower lows|bearish)\b/.test(lower) && !/\b(uptrend|higher highs|higher lows|bullish)\b/.test(lower);
  const visibleFunding = read.fundingRate.trim();
  const funding = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(visibleFunding) ? Number(visibleFunding.replace(/\s*%$/, "")) : NaN;
  const positiveFunding = read.fundingRate.trim() !== "" && Number.isFinite(funding) && funding > 0;
  const negativeFunding = read.fundingRate.trim() !== "" && Number.isFinite(funding) && funding < 0;
  const conflict = up && negativeFunding ? "Price structure is rising while the visible funding rate is negative. These observations differ; the rate does not establish a reversal."
    : down && positiveFunding ? "Price structure is falling while the visible funding rate is positive. These observations differ; the rate does not establish a reversal."
    : "No defensible conflict with chart structure can be established from these visible metrics.";
  return { status: "CONTEXT", symbol: base, message: `Screenshot-only derivatives context${read.period.trim() ? ` · ${read.period.trim().slice(0, 40)}` : ""}. Values may be stale or venue-specific.`, observations, conflict };
}
