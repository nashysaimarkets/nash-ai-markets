export type MarketDataStatus =
  | "LIVE"
  | "DELAYED"
  | "PREVIEW"
  | "UNAVAILABLE";

export type MarketQuote = {
  symbol: string;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
};

export type MarketLevel = {
  label: string;
  value: string;
  note: string;
  type: "resistance" | "pivot" | "support";
};

export type MarketEvent = {
  time: string;
  name: string;
  risk: "HIGH" | "MED";
};

export type MarketSnapshot = {
  status: MarketDataStatus;
  source: string;
  asOf: string;
  quotes: MarketQuote[];
  levels: MarketLevel[];
  events: MarketEvent[];
  bias: string;
  risk: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  summary: string;
};

const previewSnapshot: MarketSnapshot = {
  status: "PREVIEW",
  source: "NASH AI demonstration dataset",
  asOf: new Date().toISOString(),
  quotes: [
    { symbol: "ES", label: "ES FUTURES", value: "6,318.25", change: "+0.34%", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "16.42", change: "−1.08%", direction: "down" },
    { symbol: "US10Y", label: "10Y YIELD", value: "4.31%", change: "+3 bps", direction: "up" },
    { symbol: "DXY", label: "US DOLLAR", value: "97.84", change: "FLAT", direction: "flat" },
  ],
  levels: [
    { label: "R2", value: "6,350", note: "Momentum breakout", type: "resistance" },
    { label: "R1", value: "6,332", note: "First resistance", type: "resistance" },
    { label: "PV", value: "6,310", note: "Daily pivot", type: "pivot" },
    { label: "S1", value: "6,288", note: "First support", type: "support" },
    { label: "S2", value: "6,264", note: "Overnight range low", type: "support" },
  ],
  events: [
    { time: "13:30 UK", name: "US economic data", risk: "HIGH" },
    { time: "14:30 UK", name: "US cash session opens", risk: "HIGH" },
    { time: "19:00 UK", name: "Federal Reserve speaker", risk: "MED" },
  ],
  bias: "NEUTRAL → BULLISH",
  risk: "ELEVATED",
  summary:
    "Preview-only market structure. Connect a licensed data endpoint before treating any figure as current.",
};

function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketSnapshot>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.asOf === "string" &&
    Array.isArray(candidate.quotes) &&
    Array.isArray(candidate.levels) &&
    Array.isArray(candidate.events) &&
    typeof candidate.bias === "string" &&
    typeof candidate.risk === "string" &&
    typeof candidate.summary === "string"
  );
}

/**
 * Reads a normalized market snapshot from a private server-side endpoint.
 *
 * Required environment variable:
 *   MARKET_DATA_API_URL=https://your-provider-or-worker.example/api/market-snapshot
 *
 * Optional:
 *   MARKET_DATA_API_TOKEN=secret-token
 *
 * The endpoint must return JSON matching MarketSnapshot. If the endpoint is
 * missing, slow, malformed, or unavailable, the terminal falls back to a
 * clearly labelled preview dataset instead of displaying stale figures as live.
 */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const url = process.env.MARKET_DATA_API_URL;

  if (!url) {
    return previewSnapshot;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url, {
      headers: process.env.MARKET_DATA_API_TOKEN
        ? { Authorization: `Bearer ${process.env.MARKET_DATA_API_TOKEN}` }
        : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Market data endpoint returned ${response.status}`);
    }

    const payload: unknown = await response.json();

    if (!isMarketSnapshot(payload)) {
      throw new Error("Market data endpoint returned an invalid payload");
    }

    return payload;
  } catch (error) {
    console.error("Market data fetch failed:", error);

    return {
      ...previewSnapshot,
      status: "UNAVAILABLE",
      source: "Live feed unavailable — preview fallback",
      asOf: new Date().toISOString(),
      summary:
        "The live feed could not be verified. Preview figures are shown only to demonstrate the terminal layout.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatUkTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return "Timestamp unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
