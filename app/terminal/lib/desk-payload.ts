/**
 * Server-side desk payload — verified snapshot + candles only.
 */

import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketGatewayStatus } from "../../lib/live-market-gateway.ts";
import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";
import type { MarketStructureLevels } from "../../lib/market-structure-levels.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import type { CandleInstrument } from "../../lib/providers/candle-instruments.ts";
import type { EdgeBrief } from "./edge-brief.ts";
import type { CatalystRadar } from "./catalyst-radar.ts";
import type { SessionClockReading } from "./session-clock.ts";
import type { DeskWorkspaceState } from "./desk-workspace.ts";
import type { BriefChangeSummary } from "../../lib/brief-change-summary.ts";

export type DeskCandleBundle = Record<CandleInstrument, CustomerCandleSeries>;

export type DeskFreshnessFeed = {
  id: string;
  label: string;
  status: "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE" | "PREVIOUS_SESSION" | "MARKET_CLOSED";
  ageLabel: string;
  detail: string;
};

export type TradingDeskPayload = {
  paid: boolean;
  tier: string;
  snapshot: MarketSnapshot;
  gatewayStatus: MarketGatewayStatus;
  marketState: string;
  timestamp: string;
  snapshotAge: string;
  candleSeriesByInstrument: DeskCandleBundle | null;
  structureLevels: MarketStructureLevels | null;
  deskSignals: MarketDeskSignals | null;
  session: SessionClockReading;
  edgeBriefByMarketId: Record<string, EdgeBrief>;
  catalystRadar: CatalystRadar;
  freshnessFeeds: DeskFreshnessFeed[];
  customerWarnings: string[];
  briefChange: BriefChangeSummary | null;
  initialWorkspace: DeskWorkspaceState;
  preview: {
    eligible: boolean;
    available: boolean;
    cadence?: "weekly" | "daily";
  };
};

export function mapCandleFreshness(
  series: CustomerCandleSeries | null | undefined,
  label: string,
): DeskFreshnessFeed {
  if (!series || series.status === "unavailable") {
    return {
      id: label,
      label,
      status: "UNAVAILABLE",
      ageLabel: "Unavailable",
      detail: series?.failureCategory
        ? `Provider path failed (${series.failureCategory}). No invented candles.`
        : "No verified candle series for this feed.",
    };
  }
  if (series.status === "stale") {
    return {
      id: label,
      label,
      status: "STALE",
      ageLabel: series.dataAgeMs != null ? `${Math.floor(series.dataAgeMs / 60_000)}m old` : "Age unavailable",
      detail: "Verified bars are older than the freshness window.",
    };
  }
  if (series.status === "previous_session" || series.classification === "previous_session") {
    return {
      id: label,
      label,
      status: "PREVIOUS_SESSION",
      ageLabel: series.dataAgeMs != null ? `${Math.floor(series.dataAgeMs / 60_000)}m old` : "Age unavailable",
      detail: "Showing previous session verified history.",
    };
  }
  if (series.status === "market_closed" || series.classification === "market_closed") {
    return {
      id: label,
      label,
      status: "MARKET_CLOSED",
      ageLabel: series.dataAgeMs != null ? `${Math.floor(series.dataAgeMs / 60_000)}m old` : "Age unavailable",
      detail: "Market closed — last verified bars retained.",
    };
  }
  return {
    id: label,
    label,
    status: "DELAYED",
    ageLabel: series.dataAgeMs != null ? `${Math.floor(series.dataAgeMs / 60_000)}m old` : "Age unavailable",
    detail: "Verified delayed provider series — never treated as live ticks.",
  };
}
