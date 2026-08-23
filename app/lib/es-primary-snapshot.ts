/**
 * Request-scoped primary ES quote snapshot.
 * Separates verified quote prints from candle closes — never silently merges them.
 */

import type { MarketQuote, MarketSnapshot } from "./market-data.ts";

export type EsQuoteSnapshot = {
  available: boolean;
  value: string | null;
  absoluteChange: string | null;
  percentChange: string | null;
  direction: MarketQuote["direction"] | "unknown";
  sourceTimestamp: string | null;
  retrievalTimestamp: string;
  delayStatus: MarketSnapshot["status"];
  ageLabel: string;
  provenance: string;
  kind: "verified-quote";
};

export type EsCandleCloseSnapshot = {
  available: boolean;
  close: string | null;
  sourceTimestamp: string | null;
  ageLabel: string;
  provenance: string;
  kind: "verified-candle-close";
};

function findEsQuote(snapshot: MarketSnapshot): MarketQuote | undefined {
  return snapshot.quotes.find((quote) => quote.symbol === "ES");
}

function formatPts(value: number): string {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildEsQuoteSnapshot(input: {
  snapshot: MarketSnapshot;
  ageLabel: string;
  retrievalTimestamp?: string;
}): EsQuoteSnapshot {
  const quote = findEsQuote(input.snapshot);
  const retrievalTimestamp = input.retrievalTimestamp ?? new Date().toISOString();
  if (!quote) {
    return {
      available: false,
      value: null,
      absoluteChange: null,
      percentChange: null,
      direction: "unknown",
      sourceTimestamp: null,
      retrievalTimestamp,
      delayStatus: input.snapshot.status,
      ageLabel: input.ageLabel,
      provenance: input.snapshot.source || "Verified provider",
      kind: "verified-quote",
    };
  }

  const change = quote.change?.trim() ?? null;
  const looksPercent = Boolean(change && /%/.test(change));
  return {
    available: true,
    value: quote.value,
    absoluteChange: looksPercent ? null : change,
    percentChange: looksPercent ? change : null,
    direction: quote.direction,
    sourceTimestamp: input.snapshot.asOf,
    retrievalTimestamp,
    delayStatus: input.snapshot.status,
    ageLabel: input.ageLabel,
    provenance: input.snapshot.source || "Verified provider",
    kind: "verified-quote",
  };
}

export function buildEsCandleCloseSnapshot(input: {
  close: number | null;
  sourceTimestamp: string | null;
  ageLabel: string;
}): EsCandleCloseSnapshot {
  if (input.close == null || !Number.isFinite(input.close)) {
    return {
      available: false,
      close: null,
      sourceTimestamp: null,
      ageLabel: input.ageLabel,
      provenance: "Verified ES candles",
      kind: "verified-candle-close",
    };
  }
  return {
    available: true,
    close: formatPts(input.close),
    sourceTimestamp: input.sourceTimestamp,
    ageLabel: input.ageLabel,
    provenance: "Verified ES candles",
    kind: "verified-candle-close",
  };
}

/** Prefer quote for hero/weather; expose candle close only as an explicitly labelled companion. */
export function resolvePrimaryEsDisplay(input: {
  quote: EsQuoteSnapshot;
  candleClose: EsCandleCloseSnapshot | null;
}): {
  primaryValue: string | null;
  primaryChange: string | null;
  primarySource: "quote" | "candle-close" | "unavailable";
  disclosure: string;
} {
  if (input.quote.available && input.quote.value) {
    const change = input.quote.absoluteChange ?? input.quote.percentChange;
    return {
      primaryValue: input.quote.value,
      primaryChange: change,
      primarySource: "quote",
      disclosure: "Primary ES figure is the latest verified delayed quote.",
    };
  }
  if (input.candleClose?.available && input.candleClose.close) {
    return {
      primaryValue: input.candleClose.close,
      primaryChange: null,
      primarySource: "candle-close",
      disclosure: "Primary ES figure is the latest verified candle close — not a live quote print.",
    };
  }
  return {
    primaryValue: null,
    primaryChange: null,
    primarySource: "unavailable",
    disclosure: "Primary ES figure awaits a verified quote or candle close.",
  };
}
