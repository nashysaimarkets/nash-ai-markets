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

export function chartDisplayState(data: OhlcvPoint[], loading = false, error?: string): ChartDisplayState {
  if (loading) return "loading";
  if (error) return "error";
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
