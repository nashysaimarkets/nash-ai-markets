import type { MarketDataStatus } from "../../lib/market-data.ts";
import type { DataStatus } from "./provenance.ts";

export type PanelMarketStatus = "Live" | "Delayed" | "Cached" | "Offline";

export const TERMINAL_SHORTCUTS = [
  { key: "R", label: "Refresh terminal" },
  { key: "F", label: "Toggle full screen" },
  { key: "?", label: "Open keyboard help" },
] as const;

export const TERMINAL_SKELETON_PANELS = [
  { key: "provenance", className: "panelProvenance" },
  { key: "verdict", className: "panelVerdict" },
  { key: "elite-trade", className: "panelEliteTrade" },
  { key: "futures", className: "panelFutures" },
  { key: "brief", className: "panelBrief" },
  { key: "pre-market", className: "panelBriefing" },
  { key: "after-hours", className: "panelBriefing" },
  { key: "calendar-compact", className: "panelCalendarCompact" },
  { key: "movers", className: "panelMovers" },
  { key: "headlines", className: "panelHeadlines" },
  { key: "sentiment", className: "panelSentiment" },
  { key: "risk", className: "panelRisk" },
  { key: "probabilities", className: "panelProbabilities" },
  { key: "expected-move", className: "panelExpectedMove" },
  { key: "futures-bias", className: "panelBias" },
  { key: "options-bias", className: "panelOptionsBias" },
  { key: "levels", className: "panelLevels" },
  { key: "vix", className: "panelVix" },
  { key: "treasuries", className: "panelTreasuries" },
  { key: "dollar", className: "panelDollar" },
  { key: "calendar", className: "panelCalendar" },
  { key: "fear-greed", className: "panelFearGreed" },
  { key: "options", className: "panelOptions" },
] as const;

export function terminalStatusMessage(status: MarketDataStatus, failureCount = 0): string {
  if (status === "LIVE") return "VERIFIED LIVE DATA";
  if (status === "DELAYED") return "VERIFIED DELAYED DATA — CHECK THE DISPLAYED AGE BEFORE USING IT";
  if (status === "UNAVAILABLE") {
    const attempts = failureCount > 0 ? ` AFTER ${failureCount} FAILED ${failureCount === 1 ? "ATTEMPT" : "ATTEMPTS"}` : "";
    return `VERIFIED DATA IS TEMPORARILY UNAVAILABLE${attempts} — NO CURRENT MARKET SIGNALS ARE SHOWN`;
  }
  return "PREVIEW DATA — FORMAT DEMONSTRATION ONLY";
}

export function panelUnavailableMessage(status: string): string | null {
  return status === "UNAVAILABLE"
    ? "This card has no verified current data. It will recover automatically after the next successful provider response."
    : null;
}

export function panelMarketStatus(status: DataStatus): PanelMarketStatus {
  if (status === "LIVE") return "Live";
  if (status === "DELAYED") return "Delayed";
  if (status === "UNAVAILABLE") return "Offline";
  return "Cached";
}

export function formatPanelTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Update unavailable";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)} UK`;
}
