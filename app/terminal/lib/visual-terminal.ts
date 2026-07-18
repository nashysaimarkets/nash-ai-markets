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
export type ChartDataMode = "verified" | "test";

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
  void status;
  return { data: [], mode: "verified" };
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
  if (status === "PREVIEW") return "Offline";
  return "Offline";
}

export function verifiedQuote(snapshot: MarketSnapshot, symbol: string) {
  if (snapshot.status !== "LIVE" && snapshot.status !== "DELAYED") return null;
  return snapshot.quotes.find((quote) => quote.symbol === symbol) ?? null;
}

export function terminalFallbackMessage(state: TerminalMarketState, status: MarketDataStatus): string {
  if (status === "PREVIEW") return "Preview market values are disabled. Connect a verified provider before using the terminal.";
  if (state === "Delayed") return "Verified delayed data is in use. Check the displayed age before relying on any analysis.";
  if (state === "Cached") return "Cached context is displayed for reference only and cannot produce an actionable plan.";
  if (state === "Offline") return "The provider is offline or unavailable. Market values are hidden and all engines remain fail closed.";
  return "Verified live provider data is current within the permitted freshness window.";
}
