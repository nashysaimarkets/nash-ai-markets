/**
 * Edge Brief — fail-closed 60-second briefing from verified desk inputs only.
 * Never invents prices, news, or catalysts.
 */

import type { MarketEvent, MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";
import type { InstrumentStructureLevels } from "../../lib/market-structure-levels.ts";
import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import type { MarketInstrument } from "../../lib/markets/market-catalog.ts";
import type { SessionClockReading } from "./session-clock.ts";

export type EdgeBrief = {
  status: "ready" | "insufficient";
  title: string;
  secondsCopy: string;
  bullets: string[];
  disclosure: string;
};

const DISCLOSURE =
  "Market summary derived only from verified quotes, candles, calendar rows, and session rules present in this desk. Not personalised advice. Trade participation stays restricted until confirmations complete.";

function quoteForSymbol(snapshot: MarketSnapshot, symbol: string): MarketQuote | undefined {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

export function createEdgeBrief(input: {
  instrument: MarketInstrument;
  snapshot: MarketSnapshot;
  candle: CustomerCandleSeries | null;
  structure: InstrumentStructureLevels | null;
  deskSignals: MarketDeskSignals | null;
  events: MarketEvent[];
  session: SessionClockReading;
  snapshotAge: string;
}): EdgeBrief {
  const { instrument, snapshot, candle, structure, deskSignals, events, session, snapshotAge } = input;
  const quote = quoteForSymbol(snapshot, instrument.symbol);
  const hasQuote = Boolean(quote);
  const hasCandles = Boolean(candle && candle.status !== "unavailable" && candle.candles.length > 0);
  const decisionWindow = snapshot.status === "LIVE" || snapshot.status === "DELAYED";

  if (instrument.coverage === "awaiting") {
    return {
      status: "insufficient",
      title: `${instrument.name} — coverage coming soon`,
      secondsCopy: `${instrument.name} is listed in Markets, but live coverage is not yet available. No verified quote or chart feed is connected yet, so this desk will not invent a briefing.`,
      bullets: [
        `Coverage: coming soon — no verified data connection.`,
        `Session clock (US equity rules): ${session.label} · ${session.nowEt}.`,
        events[0] ? `Next verified calendar row: ${events[0].time} — ${events[0].name}.` : "No verified US macro calendar rows in the current snapshot.",
      ],
      disclosure: DISCLOSURE,
    };
  }

  if (instrument.coverage === "proxy" && !hasQuote && !hasCandles) {
    return {
      status: "insufficient",
      title: `${instrument.name} — data pending`,
      secondsCopy: `Symbol ${instrument.providerSymbol ?? instrument.symbol} is ready, but this environment has no verified quote or candle series for it yet. The market summary stays closed.`,
      bullets: [
        `Do not treat the catalog row as a live price.`,
        `Session context: ${session.label}.`,
        `Snapshot age: ${snapshotAge}.`,
      ],
      disclosure: DISCLOSURE,
    };
  }

  if (!decisionWindow && !hasQuote) {
    return {
      status: "insufficient",
      title: `${instrument.name} — insufficient verified inputs`,
      secondsCopy: "The market snapshot is outside the live/delayed window and no displayable quote is attached. Edge Brief fails closed rather than guessing.",
      bullets: [`Data state: ${snapshot.status}.`, `Snapshot age: ${snapshotAge}.`],
      disclosure: DISCLOSURE,
    };
  }

  const bullets: string[] = [];
  if (hasQuote && quote) {
    bullets.push(`${quote.label} last ${quote.value} (${quote.change}) from the verified snapshot · ${snapshotAge}.`);
  } else {
    bullets.push("No verified quote row for this instrument in the current snapshot.");
  }

  if (hasCandles && candle) {
    const newest = candle.candles.at(-1);
    bullets.push(
      `Verified ${candle.timeframe} candles: ${candle.candles.length} bars` +
        (newest ? `; last close ${newest.close.toLocaleString("en-GB", { maximumFractionDigits: 2 })}.` : "."),
    );
  } else if (instrument.coverage === "live") {
    bullets.push("Candlestick history is not available for this instrument right now — no synthetic bars are shown.");
  }

  if (structure?.status === "ready" && structure.support && structure.resistance) {
    bullets.push(
      `Educational structure: support ${structure.support.display}, resistance ${structure.resistance.display} from verified candle range.`,
    );
  }

  if (deskSignals && deskSignals.overallLean !== "insufficient") {
    bullets.push(`Desk lean (educational): ${deskSignals.overallLean.replace("-", " ")}.`);
  }

  if (events[0]) {
    bullets.push(`Catalyst on radar: ${events[0].time} — ${events[0].name} (${events[0].risk}).`);
  } else {
    bullets.push("No US medium/high-impact calendar rows in the verified snapshot window.");
  }

  bullets.push(`Session: ${session.label} · ${session.nextEventLabel ?? "timing context only"}.`);

  const lean =
    deskSignals?.overallLean === "buying"
      ? "Bullish lean is present on educational desk signals — participation stays blocked until your own rules clear."
      : deskSignals?.overallLean === "selling"
        ? "Bearish lean is present on educational desk signals — participation stays blocked until your own rules clear."
        : "No strong directional lean is asserted beyond the verified inputs above.";

  return {
    status: "ready",
    title: `${instrument.name} — 60-second summary`,
    secondsCopy: `${instrument.symbol}: ${hasQuote && quote ? `${quote.value} (${quote.change})` : "quote unavailable"} · data ${snapshot.status.toLowerCase()}. ${lean}`,
    bullets: bullets.slice(0, 6),
    disclosure: DISCLOSURE,
  };
}
