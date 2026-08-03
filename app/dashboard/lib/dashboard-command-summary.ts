/**
 * Presentation-only builders for the Dashboard command centre.
 * Uses existing verified quotes, candles, decision outputs and calendar rows.
 * Does not invent levels, breadth, catalysts or confidence.
 */

import { describeRangePosition } from "../../lib/range-position-display.ts";
import type { MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";
import { formatMembershipAwareMarketDataDisplay } from "../../lib/freshness-labels.ts";
import {
  buildEsCandleCloseSnapshot,
  buildEsQuoteSnapshot,
  resolvePrimaryEsDisplay,
} from "../../lib/es-primary-snapshot.ts";
import {
  buildDeskDecisionPresentation,
  type DeskDecisionPresentation,
} from "../../terminal/lib/desk-decision-presentation.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { candleSessionStats, exponentialMovingAverage } from "./candle-analysis.ts";
import { formatEventCountdown, selectNextEconomicEvent } from "./daily-dashboard.ts";
import { sessionStatusLabel } from "./session-levels.ts";

export type DashboardHeroModel = {
  symbolLabel: string;
  price: string | null;
  netChange: string | null;
  percentChange: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  sessionLabel: string;
  sessionDetail: string;
  delayedAgeLine: string;
  priceSourceLabel: string;
  rangePositionPct: number | null;
  rangeLow: string | null;
  rangeHigh: string | null;
  rangeNote: string | null;
  deskHref: string;
};

export type DashboardWeatherItem = {
  id: string;
  name: string;
  value: string | null;
  change: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  interpretation: string;
  available: boolean;
};

export type DashboardLevelItem = {
  label: string;
  value: string;
};

export type DashboardCatalystModel = {
  name: string;
  whenLabel: string;
  impact: string;
  countdown: string | null;
  startsAt: string;
  includes: string[];
} | null;

export type DashboardServiceItem = {
  label: string;
  detail: string;
};

export type DashboardCommandSummary = {
  hero: DashboardHeroModel;
  decision: DeskDecisionPresentation;
  weather: DashboardWeatherItem[];
  levels: DashboardLevelItem[];
  levelsNote: string | null;
  catalyst: DashboardCatalystModel;
  unavailable: DashboardServiceItem[];
};

function findQuote(quotes: MarketQuote[], symbol: string) {
  return quotes.find((item) => item.symbol === symbol);
}

function formatPts(value: number): string {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(value: number, digits = 2): string {
  const abs = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function quoteInterpretation(name: string, direction: MarketQuote["direction"] | undefined, available: boolean): string {
  if (!available) return `${name} awaits a verified reading.`;
  if (direction === "up") return `${name} is higher on the latest verified print.`;
  if (direction === "down") return `${name} is lower on the latest verified print.`;
  if (direction === "flat") return `${name} is broadly unchanged on the latest verified print.`;
  return `${name} direction is not confirmed yet.`;
}

function formatEventWhen(isoOrRaw: string, timeZone = "Europe/London"): string {
  const ms = Date.parse(isoOrRaw);
  if (!Number.isFinite(ms)) return isoOrRaw;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

export function buildDashboardWeather(quotes: MarketQuote[]): DashboardWeatherItem[] {
  const cards: Array<{ id: string; name: string; symbols: string[] }> = [
    { id: "ES", name: "ES", symbols: ["ES"] },
    { id: "VIX", name: "VIX", symbols: ["VIX"] },
    { id: "DXY", name: "DXY", symbols: ["DXY"] },
    { id: "US10Y", name: "US 10-year", symbols: ["US10Y"] },
  ];

  return cards.map((card) => {
    const quote = card.symbols.map((symbol) => findQuote(quotes, symbol)).find(Boolean);
    if (!quote) {
      return {
        id: card.id,
        name: card.name,
        value: null,
        change: null,
        direction: "unknown",
        interpretation: quoteInterpretation(card.name, undefined, false),
        available: false,
      };
    }
    return {
      id: card.id,
      name: card.name,
      value: quote.value,
      change: quote.change,
      direction: quote.direction,
      interpretation: quoteInterpretation(card.name, quote.direction, true),
      available: true,
    };
  });
}

export function buildDashboardLevels(candleSeries: CustomerCandleSeries | null): {
  levels: DashboardLevelItem[];
  note: string | null;
} {
  if (!candleSeries?.candles?.length) {
    return {
      levels: [],
      note: "Verified ES candle history is required before 24-hour reference levels can appear.",
    };
  }

  const stats = candleSessionStats(candleSeries.candles);
  if (!stats || !(stats.high > stats.low)) {
    return {
      levels: [],
      note: "ES reference levels are withheld until a verified 24-hour range is available.",
    };
  }

  const levels: DashboardLevelItem[] = [
    { label: "24-hour low / downside reference", value: formatPts(stats.low) },
    { label: "Range midpoint", value: formatPts((stats.high + stats.low) / 2) },
    { label: "Session opening reference", value: formatPts(stats.firstAvailableClose) },
  ];
  const ema = exponentialMovingAverage(candleSeries.candles, 20);
  const emaLatest = ema.at(-1)?.value;
  if (emaLatest != null && Number.isFinite(emaLatest)) {
    levels.push({ label: "EMA 20", value: formatPts(emaLatest) });
  }
  levels.push({ label: "24-hour high / upside reference", value: formatPts(stats.high) });

  return {
    levels,
    note: "Educational references from the verified 24-hour candle window — not confirmed support or resistance.",
  };
}

export function buildDashboardCommandSummary(input: {
  snapshot: MarketSnapshot;
  session: SessionClockReading;
  candleSeries: CustomerCandleSeries | null;
  decision: TradingDecision | null;
  plan: TradePlan | null;
  signals: MarketDeskSignals | null;
  warnings: string[];
  candleAccess?: boolean;
  now?: number;
  timeZone?: string;
}): DashboardCommandSummary {
  const now = input.now ?? Date.now();
  const timeZone = input.timeZone ?? "Europe/London";
  const retrievalTimestamp = new Date(now).toISOString();
  const delayedAgeLine = formatMembershipAwareMarketDataDisplay({
    candleAgeMs: input.candleSeries?.dataAgeMs ?? null,
    candleAccess: input.candleAccess ?? true,
    quoteAvailable: input.snapshot.quotes.some((quote) => quote.symbol === "ES"),
  });
  const esQuoteSnapshot = buildEsQuoteSnapshot({
    snapshot: input.snapshot,
    ageLabel: delayedAgeLine,
    retrievalTimestamp,
  });
  const stats = input.candleSeries?.candles?.length
    ? candleSessionStats(input.candleSeries.candles)
    : null;
  const candleClose = buildEsCandleCloseSnapshot({
    close: stats?.latest ?? null,
    sourceTimestamp: input.candleSeries?.asOf ?? null,
    ageLabel: delayedAgeLine,
  });
  const primaryEs = resolvePrimaryEsDisplay({
    quote: esQuoteSnapshot,
    candleClose,
  });
  const quoteNumber = esQuoteSnapshot.value
    ? Number.parseFloat(esQuoteSnapshot.value.replace(/[^0-9.-]/g, ""))
    : NaN;
  const rangeReading = stats
    ? describeRangePosition(
        Number.isFinite(quoteNumber) ? quoteNumber : stats.latest,
        stats.low,
        stats.high,
      )
    : null;

  const heroUsesQuote = primaryEs.primarySource === "quote";
  const hero: DashboardHeroModel = {
    symbolLabel: "S&P 500 Futures · ES",
    price: primaryEs.primaryValue,
    netChange: heroUsesQuote
      ? (esQuoteSnapshot.absoluteChange ?? primaryEs.primaryChange)
      : stats
        ? `${formatSigned(stats.change)} pts (candle)`
        : null,
    percentChange: heroUsesQuote
      ? (esQuoteSnapshot.percentChange ?? (esQuoteSnapshot.absoluteChange ? null : primaryEs.primaryChange))
      : stats
        ? `${formatSigned(stats.percentageChange)}% (candle)`
        : null,
    direction: heroUsesQuote
      ? esQuoteSnapshot.direction
      : stats
        ? (stats.change > 0 ? "up" : stats.change < 0 ? "down" : "flat")
        : "unknown",
    sessionLabel: sessionStatusLabel(input.session.phase),
    sessionDetail: input.session.countdownLabel
      ? `${input.session.label} · ${input.session.countdownLabel}`
      : input.session.label,
    delayedAgeLine,
    priceSourceLabel: primaryEs.disclosure,
    rangePositionPct: rangeReading?.displayPct ?? null,
    rangeLow: stats ? formatPts(stats.low) : null,
    rangeHigh: stats ? formatPts(stats.high) : null,
    rangeNote: rangeReading?.note ?? null,
    deskHref: "/terminal",
  };

  const decision = buildDeskDecisionPresentation({
    decision: input.decision,
    plan: input.plan,
    signals: input.signals,
    warnings: input.warnings,
  });

  const weather = buildDashboardWeather(input.snapshot.quotes).map((item) => {
    if (item.id !== "ES" || !esQuoteSnapshot.available) return item;
    const direction = esQuoteSnapshot.direction === "unknown" ? undefined : esQuoteSnapshot.direction;
    return {
      ...item,
      value: esQuoteSnapshot.value,
      change: esQuoteSnapshot.absoluteChange ?? esQuoteSnapshot.percentChange,
      direction: esQuoteSnapshot.direction,
      interpretation: `${quoteInterpretation("ES", direction, true)} Same verified quote snapshot as the hero.`,
    };
  });
  const { levels, note: levelsNote } = buildDashboardLevels(input.candleSeries);

  const next = selectNextEconomicEvent(input.snapshot.events, now);
  const catalyst: DashboardCatalystModel = next
    ? {
        name: next.name,
        whenLabel: formatEventWhen(next.startsAt, timeZone),
        impact: next.risk === "HIGH" ? "High impact" : "Medium impact",
        countdown: formatEventCountdown(next.startsAt, now),
        startsAt: next.startsAt,
        includes: next.includes,
      }
    : null;

  const unavailable: DashboardServiceItem[] = [];
  for (const item of weather.filter((row) => !row.available)) {
    unavailable.push({
      label: `${item.name} weather`,
      detail: item.interpretation,
    });
  }
  if (!input.candleSeries?.candles?.length) {
    unavailable.push({
      label: "ES candle chart",
      detail: "Open Trading Desk once verified candles are connected for interactive OHLCV.",
    });
  }
  if (!catalyst) {
    unavailable.push({
      label: "Upcoming catalyst",
      detail: "No upcoming verified event is currently available.",
    });
  }
  if (!levels.length) {
    unavailable.push({
      label: "Verified levels",
      detail: levelsNote ?? "Reference levels await verified ES candles.",
    });
  }

  return {
    hero,
    decision,
    weather: weather.filter((item) => item.available),
    levels,
    levelsNote,
    catalyst,
    unavailable,
  };
}
