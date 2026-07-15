export type MarketDataStatus = "LIVE" | "DELAYED" | "PREVIEW" | "UNAVAILABLE";

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

export type MarketEvent = { time: string; name: string; risk: "HIGH" | "MED" };

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
  evidence: Record<string, number>;
};

const VALID_STATUSES = new Set<MarketDataStatus>(["LIVE", "DELAYED", "PREVIEW", "UNAVAILABLE"]);
const MAX_LIVE_AGE_MS = 5 * 60 * 1000;
const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;

function createPreviewSnapshot(): MarketSnapshot {
  return {
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
    summary: "Preview-only market structure. Connect a licensed data endpoint before treating any figure as current.",
    evidence: { trend: 58, momentum: 55, volatility: 48, breadth: 54, macro: 50 },
  };
}

function isScoreRecord(value: unknown): value is Record<string, number> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((score) =>
      typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100,
    );
}

function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketSnapshot>;
  return typeof candidate.status === "string" &&
    VALID_STATUSES.has(candidate.status as MarketDataStatus) &&
    typeof candidate.source === "string" && candidate.source.trim().length > 0 &&
    typeof candidate.asOf === "string" && candidate.asOf.trim().length > 0 &&
    Array.isArray(candidate.quotes) && Array.isArray(candidate.levels) &&
    Array.isArray(candidate.events) && typeof candidate.bias === "string" &&
    typeof candidate.risk === "string" && typeof candidate.summary === "string" &&
    isScoreRecord(candidate.evidence);
}

export function normalizeSnapshotFreshness(snapshot: MarketSnapshot, now = Date.now()): MarketSnapshot {
  if (snapshot.status === "PREVIEW" || snapshot.status === "UNAVAILABLE") return snapshot;
  const timestamp = new Date(snapshot.asOf).getTime();
  if (Number.isNaN(timestamp)) {
    return { ...snapshot, status: "UNAVAILABLE", source: `${snapshot.source} — invalid timestamp`, summary: "The market feed timestamp could not be verified. Do not treat these figures as current." };
  }
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs > MAX_DELAYED_AGE_MS) {
    return { ...snapshot, status: "UNAVAILABLE", source: `${snapshot.source} — stale over 30 minutes`, summary: "The market feed is more than 30 minutes old and unavailable for current decision support." };
  }
  if (snapshot.status === "LIVE" && ageMs > MAX_LIVE_AGE_MS) {
    return { ...snapshot, status: "DELAYED", source: `${snapshot.source} — delayed over 5 minutes`, summary: `Delayed data: ${snapshot.summary}` };
  }
  return snapshot;
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const url = process.env.MARKET_DATA_API_URL;
  if (!url) return createPreviewSnapshot();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);
  try {
    const response = await fetch(url, {
      headers: process.env.MARKET_DATA_API_TOKEN ? { Authorization: `Bearer ${process.env.MARKET_DATA_API_TOKEN}` } : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Market data endpoint returned ${response.status}`);
    const payload: unknown = await response.json();
    if (!isMarketSnapshot(payload)) throw new Error("Market data endpoint returned an invalid payload");
    return normalizeSnapshotFreshness(payload);
  } catch (error) {
    console.error("[bullseye:market-data] fetch failed", { error: error instanceof Error ? error.message : "Unknown error", urlConfigured: true });
    return { ...createPreviewSnapshot(), status: "UNAVAILABLE", source: "Live feed unavailable — preview fallback", summary: "The live feed could not be verified. Preview figures are shown only to demonstrate the terminal layout." };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatUkTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}

export function formatSnapshotAge(isoTimestamp: string, now = Date.now()): string {
  const timestamp = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestamp)) return "age unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
}
