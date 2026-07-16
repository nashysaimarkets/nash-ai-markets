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

export type MarketDataProvider = {
  fetchSnapshot: () => Promise<MarketSnapshot | null>;
};

export type MarketDataProviderInput = MarketDataProvider | (() => Promise<MarketSnapshot | null>);

export type GetMarketSnapshotOptions = {
  provider?: MarketDataProviderInput;
  now?: number;
};

const VALID_STATUSES = new Set<MarketDataStatus>(["LIVE", "DELAYED", "PREVIEW", "UNAVAILABLE"]);
const MAX_LIVE_AGE_MS = 5 * 60 * 1000;
const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;

export function createPreviewSnapshot(): MarketSnapshot {
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

export function createUnavailableSnapshot(asOf = new Date().toISOString()): MarketSnapshot {
  return {
    status: "UNAVAILABLE",
    source: "No verified live market provider",
    asOf,
    quotes: [],
    levels: [],
    events: [],
    bias: "UNAVAILABLE",
    risk: "HIGH",
    summary: "Verified market data is unavailable. No live values or directional guidance have been supplied by the market gateway.",
    evidence: {},
  };
}

function isScoreRecord(value: unknown): value is Record<string, number> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((score) =>
      typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100,
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDirection(value: unknown): MarketQuote["direction"] {
  return value === "up" || value === "down" ? value : "flat";
}

function normalizeRisk(value: unknown): MarketSnapshot["risk"] {
  return value === "LOW" || value === "MODERATE" || value === "ELEVATED" || value === "HIGH" ? value : "MODERATE";
}

function normalizeQuote(symbol: string, value: unknown): MarketQuote | null {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<MarketQuote> & Record<string, unknown>;
  const resolvedSymbol = typeof candidate.symbol === "string" && candidate.symbol.trim().length > 0
    ? candidate.symbol
    : symbol;
  return {
    symbol: resolvedSymbol,
    label: typeof candidate.label === "string" ? candidate.label : resolvedSymbol,
    value: typeof candidate.value === "string" || typeof candidate.value === "number" ? String(candidate.value) : "—",
    change: typeof candidate.change === "string" || typeof candidate.change === "number" ? String(candidate.change) : "flat",
    direction: normalizeDirection(candidate.direction),
  };
}

function normalizeLevel(value: unknown): MarketLevel | null {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<MarketLevel>;
  if (!candidate.label || !candidate.value || typeof candidate.note !== "string") return null;
  return {
    label: String(candidate.label),
    value: String(candidate.value),
    note: String(candidate.note),
    type: candidate.type === "resistance" || candidate.type === "pivot" || candidate.type === "support" ? candidate.type : "support",
  };
}

function normalizeEvent(value: unknown): MarketEvent | null {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<MarketEvent>;
  if (!candidate.time || !candidate.name) return null;
  return {
    time: String(candidate.time),
    name: String(candidate.name),
    risk: candidate.risk === "HIGH" ? "HIGH" : "MED",
  };
}

function normalizeProviderPayload(payload: unknown): MarketSnapshot | null {
  if (isMarketSnapshot(payload)) return payload;
  if (!isRecord(payload)) return null;

  const candidate = payload as Record<string, unknown>;
  const dataSection = isRecord(candidate.data) ? candidate.data : candidate;
  const rawQuotes = dataSection.quotes ?? candidate.quotes;
  const rawLevels = dataSection.levels ?? candidate.levels;
  const rawEvents = dataSection.events ?? candidate.events;
  const fallbackSnapshot = createPreviewSnapshot();

  const quotes = Array.isArray(rawQuotes)
    ? rawQuotes.map((quote, index) => normalizeQuote(typeof (quote as Record<string, unknown>)?.symbol === "string" ? String((quote as Record<string, unknown>).symbol) : `Q${index + 1}`, quote)).filter((quote): quote is MarketQuote => Boolean(quote))
    : isRecord(rawQuotes)
      ? Object.entries(rawQuotes).map(([symbol, quote]) => normalizeQuote(symbol, quote)).filter((quote): quote is MarketQuote => Boolean(quote))
      : fallbackSnapshot.quotes;

  const levels = Array.isArray(rawLevels)
    ? rawLevels.map((level) => normalizeLevel(level)).filter((level): level is MarketLevel => Boolean(level))
    : fallbackSnapshot.levels;

  const events = Array.isArray(rawEvents)
    ? rawEvents.map((event) => normalizeEvent(event)).filter((event): event is MarketEvent => Boolean(event))
    : fallbackSnapshot.events;

  const status = typeof candidate.status === "string" && VALID_STATUSES.has(candidate.status as MarketDataStatus)
    ? candidate.status as MarketDataStatus
    : typeof dataSection.status === "string" && VALID_STATUSES.has(dataSection.status as MarketDataStatus)
      ? dataSection.status as MarketDataStatus
      : "PREVIEW";

  const source = typeof candidate.source === "string" && candidate.source.trim().length > 0
    ? candidate.source
    : typeof dataSection.source === "string" && dataSection.source.trim().length > 0
      ? dataSection.source
      : "Live market data provider";

  const asOf = typeof candidate.asOf === "string" && candidate.asOf.trim().length > 0
    ? candidate.asOf
    : typeof dataSection.asOf === "string" && dataSection.asOf.trim().length > 0
      ? dataSection.asOf
      : new Date().toISOString();

  const bias = typeof candidate.bias === "string" && candidate.bias.trim().length > 0
    ? candidate.bias
    : typeof dataSection.bias === "string" && dataSection.bias.trim().length > 0
      ? dataSection.bias
      : fallbackSnapshot.bias;

  const risk = normalizeRisk(candidate.risk ?? dataSection.risk);
  const summary = typeof candidate.summary === "string" && candidate.summary.trim().length > 0
    ? candidate.summary
    : typeof dataSection.summary === "string" && dataSection.summary.trim().length > 0
      ? dataSection.summary
      : fallbackSnapshot.summary;

  return {
    status,
    source,
    asOf,
    quotes,
    levels,
    events,
    bias,
    risk,
    summary,
    evidence: isScoreRecord(candidate.evidence ?? dataSection.evidence)
      ? candidate.evidence ?? dataSection.evidence
      : fallbackSnapshot.evidence,
  };
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

function normalizeUnavailableSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
  return {
    ...snapshot,
    status: "UNAVAILABLE",
    source: "Live feed unavailable — preview fallback",
    summary: "The live feed could not be verified. Preview figures are shown only to demonstrate the terminal layout.",
  };
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

function resolveProvider(provider?: MarketDataProviderInput): MarketDataProvider | null {
  if (!provider) return null;
  if (typeof provider === "function") {
    return { fetchSnapshot: provider };
  }
  return provider;
}

export function createHttpMarketDataProvider(input?: { url?: string; token?: string; timeoutMs?: number }): MarketDataProvider {
  return {
    async fetchSnapshot() {
      const url = input?.url ?? process.env.MARKET_DATA_API_URL;
      if (!url) return null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input?.timeoutMs ?? 4_500);
      try {
        const response = await fetch(url, {
          headers: (input?.token ?? process.env.MARKET_DATA_API_TOKEN)
            ? { Authorization: `Bearer ${input?.token ?? process.env.MARKET_DATA_API_TOKEN}` }
            : undefined,
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Market data endpoint returned ${response.status}`);
        const payload: unknown = await response.json();
        const normalized = normalizeProviderPayload(payload);
        if (!normalized) throw new Error("Market data endpoint returned an invalid payload");
        return normalized;
      } catch (error) {
        console.error("[bullseye:market-data] fetch failed", { error: error instanceof Error ? error.message : "Unknown error", urlConfigured: Boolean(url) });
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function getMarketSnapshot(options: GetMarketSnapshotOptions = {}): Promise<MarketSnapshot> {
  const provider = resolveProvider(options.provider);
  if (provider) {
    try {
      const snapshot = await provider.fetchSnapshot();
      if (snapshot) return normalizeSnapshotFreshness(snapshot, options.now);
    } catch (error) {
      console.error("[bullseye:market-data] provider failed", { error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  const httpProvider = createHttpMarketDataProvider();
  const snapshot = await httpProvider.fetchSnapshot();
  if (snapshot) return normalizeSnapshotFreshness(snapshot, options.now);

  if (options.provider) {
    return normalizeUnavailableSnapshot(createPreviewSnapshot());
  }

  return createPreviewSnapshot();
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
