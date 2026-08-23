/**
 * Dense command-centre strip — verified quotes only.
 * Unavailable instruments stay explicitly empty (never fabricated).
 */

import type { MarketQuote } from "../../lib/market-data.ts";
import type { DeskDecisionPresentation } from "../../terminal/lib/desk-decision-presentation.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import type { DashboardHeroModel, DashboardWeatherItem } from "./dashboard-command-summary.ts";

/**
 * "pending" is a feed we read but have no verified value for right now.
 * "unconfigured" is an instrument the dashboard has no verified source for at
 * all. Both are withheld rather than estimated, but only the first can change
 * during a session, so the two deserve different prominence.
 */
export type CommandStripCoverage = "verified" | "pending" | "unconfigured";

export type CommandStripCell = {
  id: string;
  label: string;
  value: string;
  detail: string | null;
  tone: "up" | "down" | "flat" | "neutral" | "caution" | "risk" | "ok";
  available: boolean;
  coverage: CommandStripCoverage;
  sparkline?: number[] | null;
};

export type CommandStripModel = {
  cells: CommandStripCell[];
  updatedLabel: string;
  disclosure: string;
};

function fromQuote(quote: MarketQuote | undefined, id: string, label: string): CommandStripCell {
  if (!quote) {
    return {
      id,
      label,
      value: "—",
      detail: "Awaiting verified quote",
      tone: "neutral",
      available: false,
      coverage: "pending",
    };
  }
  return {
    id,
    label,
    value: quote.value,
    detail: quote.change,
    tone: quote.direction === "up" || quote.direction === "down" || quote.direction === "flat" ? quote.direction : "neutral",
    available: true,
    coverage: "verified",
  };
}

function weatherCell(items: DashboardWeatherItem[], id: string, label?: string): CommandStripCell {
  const item = items.find((row) => row.id === id);
  if (!item?.available) {
    return {
      id,
      label: label ?? id,
      value: "—",
      detail: "Awaiting verified quote",
      tone: "neutral",
      available: false,
      coverage: "pending",
    };
  }
  return {
    id,
    label: label ?? item.name,
    value: item.value ?? "—",
    detail: item.change,
    tone: item.direction === "unknown" ? "neutral" : item.direction,
    available: true,
    coverage: "verified",
  };
}

/** Build the trading command strip from verified summary + optional snapshot quotes. */
export function buildCommandStrip(input: {
  hero: DashboardHeroModel;
  decision: DeskDecisionPresentation;
  weather: DashboardWeatherItem[];
  session: SessionClockReading;
  quotes: MarketQuote[];
  expectedMove: string | null;
  esSparkline?: number[] | null;
}): CommandStripModel {
  const oil = input.quotes.find((item) => item.symbol === "OIL" || item.symbol === "USO");
  const cells: CommandStripCell[] = [
    {
      id: "ES",
      label: "ES Futures",
      value: input.hero.price ?? "—",
      detail: input.hero.netChange,
      tone: input.hero.direction === "unknown" ? "neutral" : input.hero.direction,
      available: Boolean(input.hero.price),
      coverage: input.hero.price ? "verified" : "pending",
      sparkline: input.esSparkline ?? null,
    },
    {
      id: "session",
      label: "Session",
      value: input.hero.sessionLabel,
      detail: input.session.countdownLabel
        ? input.session.countdownLabel
        : input.hero.sessionDetail,
      tone: "ok",
      available: true,
      coverage: "verified",
    },
    {
      id: "bias",
      label: "Today’s bias",
      value: input.decision.leanLabel,
      detail: input.decision.permissionLabel,
      tone:
        input.decision.leanTone === "bull"
          ? "up"
          : input.decision.leanTone === "bear"
            ? "down"
            : input.decision.permissionTone === "blocked"
              ? "caution"
              : "neutral",
      available: true,
      coverage: "verified",
    },
    {
      id: "expected",
      label: "Expected move",
      value: input.expectedMove ?? "—",
      detail: input.expectedMove ? "24h verified range" : "Awaiting candles",
      tone: "neutral",
      available: Boolean(input.expectedMove),
      coverage: input.expectedMove ? "verified" : "pending",
    },
    {
      id: "risk",
      label: "Market risk",
      value: input.decision.riskLabel,
      detail: input.decision.primaryRisk,
      tone: input.decision.permissionTone === "blocked" ? "risk" : "caution",
      available: true,
      coverage: "verified",
    },
    weatherCell(input.weather, "VIX"),
    weatherCell(input.weather, "DXY"),
    weatherCell(input.weather, "US10Y", "US 10Y"),
    fromQuote(oil, "OIL", "Oil (USO proxy)"),
    {
      id: "SPY",
      label: "SPY",
      value: "—",
      detail: "Not on verified dashboard feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
    {
      id: "GOLD",
      label: "Gold",
      value: "—",
      detail: "Not on verified dashboard feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
    {
      id: "BTC",
      label: "Bitcoin",
      value: "—",
      detail: "Not on verified dashboard feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
    {
      id: "breadth",
      label: "Breadth",
      value: "—",
      detail: "No verified breadth feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
    {
      id: "pc",
      label: "Put/Call",
      value: "—",
      detail: "No verified put/call feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
    {
      id: "tick",
      label: "Tick",
      value: "—",
      detail: "No verified tick feed",
      tone: "neutral",
      available: false,
      coverage: "unconfigured",
    },
  ];

  return {
    cells,
    updatedLabel: input.hero.delayedAgeLine,
    disclosure:
      "Command strip uses delayed verified quotes only. Empty cells are withheld — not estimated.",
  };
}
