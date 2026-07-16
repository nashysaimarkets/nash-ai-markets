import type { MarketGatewayConnectionStatus } from "../../lib/live-market-gateway.ts";
import type { MarketDataStatus, MarketSnapshot } from "../../lib/market-data.ts";

export const TERMINAL_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
export type TerminalTimeframe = typeof TERMINAL_TIMEFRAMES[number];

export type OhlcvPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartDisplayState = "ready" | "empty" | "loading" | "error";
export type TerminalMarketState = "Live" | "Delayed" | "Cached" | "Offline";
export type ChartDataMode = "verified" | "preview";

export const PREVIEW_OHLCV_FIXTURE: readonly OhlcvPoint[] = [
  { time: 1704196800, open: 4780, high: 4788, low: 4776, close: 4785, volume: 820 },
  { time: 1704200400, open: 4785, high: 4792, low: 4781, close: 4788, volume: 940 },
  { time: 1704204000, open: 4788, high: 4790, low: 4779, close: 4782, volume: 760 },
  { time: 1704207600, open: 4782, high: 4794, low: 4780, close: 4791, volume: 1100 },
  { time: 1704211200, open: 4791, high: 4798, low: 4787, close: 4796, volume: 980 },
] as const;

export function isValidOhlcv(data: readonly OhlcvPoint[]): boolean {
  return data.every((point, index) =>
    Number.isInteger(point.time) && point.time > 0 &&
    [point.open, point.high, point.low, point.close, point.volume].every(Number.isFinite) &&
    point.volume >= 0 && point.low <= Math.min(point.open, point.close) &&
    point.high >= Math.max(point.open, point.close) &&
    (index === 0 || point.time > data[index - 1]!.time),
  );
}

export function chartDataForStatus(status: MarketDataStatus): { data: readonly OhlcvPoint[]; mode: ChartDataMode } {
  return status === "PREVIEW"
    ? { data: PREVIEW_OHLCV_FIXTURE, mode: "preview" }
    : { data: [], mode: "verified" };
}

export function chartDisplayState(data: OhlcvPoint[], loading = false, error?: string): ChartDisplayState {
  if (loading) return "loading";
  if (error || !isValidOhlcv(data)) return "error";
  return data.length > 0 ? "ready" : "empty";
}

export function clampConfidence(value: number): number {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

export function terminalMarketState(status: MarketDataStatus, providerStatus: MarketGatewayConnectionStatus, fallbackActive: boolean): TerminalMarketState {
  if (status === "LIVE" && providerStatus === "connected" && !fallbackActive) return "Live";
  if (status === "DELAYED" && providerStatus !== "offline" && !fallbackActive) return "Delayed";
  if (status === "PREVIEW") return "Cached";
  return "Offline";
}

export function verifiedQuote(snapshot: MarketSnapshot, symbol: string) {
  if (snapshot.status !== "LIVE" && snapshot.status !== "DELAYED") return null;
  return snapshot.quotes.find((quote) => quote.symbol === symbol) ?? null;
}

export function terminalFallbackMessage(state: TerminalMarketState, status: MarketDataStatus): string {
  if (status === "PREVIEW") return "Preview mode uses a fixed historical chart fixture and never represents current market conditions.";
  if (state === "Delayed") return "Verified delayed data is in use. Check the displayed age before relying on any analysis.";
  if (state === "Cached") return "Cached context is displayed for reference only and cannot produce an actionable plan.";
  if (state === "Offline") return "The provider is offline or unavailable. Market values are hidden and all engines remain fail closed.";
  return "Verified live provider data is current within the permitted freshness window.";
}
