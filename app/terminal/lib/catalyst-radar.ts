/**
 * Catalyst Radar — unified timeline from verified calendar rows.
 * News/earnings slots remain truthful unavailable until provider paths exist.
 */

import type { MarketEvent } from "../../lib/market-data.ts";
import type { MarketInstrument } from "../../lib/markets/market-catalog.ts";

export type CatalystKind = "macro" | "earnings" | "news";

export type CatalystItem = {
  id: string;
  kind: CatalystKind;
  time: string;
  title: string;
  risk: "HIGH" | "MED" | "INFO";
  relevance: string;
  available: boolean;
};

export type CatalystRadar = {
  items: CatalystItem[];
  unavailable: Array<{ kind: CatalystKind; reason: string }>;
  disclosure: string;
};

const DISCLOSURE =
  "Macro rows come from the verified FMP US economic calendar when present in the snapshot. Earnings and news timelines stay unavailable until a verified provider path is wired — nothing is invented.";

function relevanceFor(instrument: MarketInstrument, favourites: MarketInstrument[]): string {
  const names = [instrument, ...favourites.filter((item) => item.id !== instrument.id)].slice(0, 4);
  if (instrument.group === "indices" || instrument.group === "etfs") {
    return `Relevant to index/ETF desk focus (${names.map((item) => item.symbol).join(", ")}).`;
  }
  if (instrument.group === "bonds_and_rates" || instrument.group === "fx") {
    return `Macro-sensitive favourites on desk: ${names.map((item) => item.symbol).join(", ")}.`;
  }
  return `Desk favourites: ${names.map((item) => item.symbol).join(", ") || instrument.symbol}.`;
}

export function createCatalystRadar(input: {
  events: MarketEvent[];
  active: MarketInstrument;
  favourites: MarketInstrument[];
}): CatalystRadar {
  const items: CatalystItem[] = input.events.slice(0, 12).map((event, index) => ({
    id: `macro-${index}-${event.time}-${event.name}`,
    kind: "macro" as const,
    time: event.time,
    title: event.name,
    risk: event.risk,
    relevance: relevanceFor(input.active, input.favourites),
    available: true,
  }));

  return {
    items,
    unavailable: [
      {
        kind: "earnings",
        reason: "No verified earnings-calendar provider path is wired for the active instrument yet.",
      },
      {
        kind: "news",
        reason: "No verified news-intelligence provider path is wired for market-filtered headlines yet.",
      },
    ],
    disclosure: DISCLOSURE,
  };
}
