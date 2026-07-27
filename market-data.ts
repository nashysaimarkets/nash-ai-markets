export type DataStatus = "LIVE" | "DELAYED" | "PREVIEW" | "UNAVAILABLE";

export type Direction = "up" | "down" | "flat";

export type MarketQuote = {
  symbol: string;
  label: string;
  value: string;
  change: string;
  direction: Direction;
};

export type MarketLevel = {
  label: string;
  value: string;
  numericValue: number;
  note: string;
  type: "resistance" | "pivot" | "support";
};

export type MarketEvent = {
  time: string;
  name: string;
  risk: "HIGH" | "MED";
};

export type EvidenceInputs = {
  trend: number;
  momentum: number;
  liquidity: number;
  breadth: number;
  volatility: number;
  macro: number;
};

export type MarketSnapshot = {
  status: DataStatus;
  source: string;
  asOf: string;
  quotes: MarketQuote[];
  levels: MarketLevel[];
  events: MarketEvent[];
  evidence: EvidenceInputs;
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
    { label: "R2", value: "6,350", numericValue: 6350, note: "Momentum breakout", type: "resistance" },
    { label: "R1", value: "6,332", numericValue: 6332, note: "First resistance", type: "resistance" },
    { label: "PV", value: "6,310", numericValue: 6310, note: "Daily pivot", type: "pivot" },
    { label: "S1", value: "6,288", numericValue: 6288, note: "First support", type: "support" },
    { label: "S2", value: "6,264", numericValue: 6264, note: "Overnight range low", type: "support" },
  ],
  events: [
    { time: "13:30 UK", name: "US economic data", risk: "HIGH" },
    { time: "14:30 UK", name: "US cash session opens", risk: "HIGH" },
    { time: "19:00 UK", name: "Federal Reserve speaker", risk: "MED" },
  ],
  evidence: {
    trend: 88,
    momentum: 82,
    liquidity: 76,
    breadth: 79,
    volatility: 68,
    macro: 61,
  },
  summary:
    "Preview-only market structure. Connect a licensed endpoint before treating any figure as current.",
};

function isSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketSnapshot>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.asOf === "string" &&
    Array.isArray(candidate.quotes) &&
    Array.isArray(candidate.levels) &&
    Array.isArray(candidate.events) &&
    typeof candidate.evidence === "object" &&
    typeof candidate.summary === "string"
  );
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const url = process.env.MARKET_DATA_API_URL;

  if (!url) return previewSnapshot;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

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

    if (!isSnapshot(payload)) {
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
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";

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
