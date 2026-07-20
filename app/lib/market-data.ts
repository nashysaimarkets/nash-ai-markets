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
  getDiagnostics?: () => MarketProviderAttemptDiagnostics;
};

export type MarketDataProviderInput = MarketDataProvider | (() => Promise<MarketSnapshot | null>);

export type MarketProviderAttemptDiagnostics = {
  resultCategory: string;
  responseReceived: boolean;
  schemaRecognized: boolean;
  quoteCount: number;
  requiredInstrumentsFound: string[];
  requiredInstrumentsMissing: string[];
  providerTimestamp: string | null;
  failureReason: string | null;
};

export type GetMarketSnapshotOptions = {
  provider?: MarketDataProviderInput;
  now?: number;
};

const VALID_STATUSES = new Set<MarketDataStatus>(["LIVE", "DELAYED", "PREVIEW", "UNAVAILABLE"]);
const MAX_LIVE_AGE_MS = 5 * 60 * 1000;
const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
export const UNAVAILABLE_SNAPSHOT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function createUnavailableSnapshot(asOf = UNAVAILABLE_SNAPSHOT_TIMESTAMP): MarketSnapshot {
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
  if (typeof candidate.value !== "string" && typeof candidate.value !== "number") return null;
  return {
    symbol: resolvedSymbol,
    label: typeof candidate.label === "string" ? candidate.label : resolvedSymbol,
    value: String(candidate.value),
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

  const quotes = Array.isArray(rawQuotes)
    ? rawQuotes.map((quote, index) => normalizeQuote(typeof (quote as Record<string, unknown>)?.symbol === "string" ? String((quote as Record<string, unknown>).symbol) : `Q${index + 1}`, quote)).filter((quote): quote is MarketQuote => Boolean(quote))
    : isRecord(rawQuotes)
      ? Object.entries(rawQuotes).map(([symbol, quote]) => normalizeQuote(symbol, quote)).filter((quote): quote is MarketQuote => Boolean(quote))
      : [];

  const levels = Array.isArray(rawLevels)
    ? rawLevels.map((level) => normalizeLevel(level)).filter((level): level is MarketLevel => Boolean(level))
    : [];

  const events = Array.isArray(rawEvents)
    ? rawEvents.map((event) => normalizeEvent(event)).filter((event): event is MarketEvent => Boolean(event))
    : [];

  const status = typeof candidate.status === "string" && VALID_STATUSES.has(candidate.status as MarketDataStatus)
    ? candidate.status as MarketDataStatus
    : typeof dataSection.status === "string" && VALID_STATUSES.has(dataSection.status as MarketDataStatus)
      ? dataSection.status as MarketDataStatus
      : "UNAVAILABLE";
  if (status !== "LIVE" && status !== "DELAYED") return null;

  const source = typeof candidate.source === "string" && candidate.source.trim().length > 0
    ? candidate.source
    : typeof dataSection.source === "string" && dataSection.source.trim().length > 0
      ? dataSection.source
      : "";

  const asOf = typeof candidate.asOf === "string" && candidate.asOf.trim().length > 0
    ? candidate.asOf
    : typeof dataSection.asOf === "string" && dataSection.asOf.trim().length > 0
      ? dataSection.asOf
      : "";
  if (!source || !asOf || !Number.isFinite(Date.parse(asOf)) || quotes.length === 0) return null;

  const bias = typeof candidate.bias === "string" && candidate.bias.trim().length > 0
    ? candidate.bias
    : typeof dataSection.bias === "string" && dataSection.bias.trim().length > 0
      ? dataSection.bias
      : "UNAVAILABLE";

  const risk = normalizeRisk(candidate.risk ?? dataSection.risk);
  const summary = typeof candidate.summary === "string" && candidate.summary.trim().length > 0
    ? candidate.summary
    : typeof dataSection.summary === "string" && dataSection.summary.trim().length > 0
      ? dataSection.summary
      : "Verified provider payload.";
  const evidence = candidate.evidence ?? dataSection.evidence;

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
    evidence: isScoreRecord(evidence)
      ? evidence
      : {},
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

export function normalizeSnapshotFreshness(snapshot: MarketSnapshot, now = Date.now()): MarketSnapshot {
  if (snapshot.status === "PREVIEW" || snapshot.status === "UNAVAILABLE") return snapshot;
  const timestamp = new Date(snapshot.asOf).getTime();
  if (Number.isNaN(timestamp)) {
    return { ...snapshot, status: "UNAVAILABLE", source: `${snapshot.source} — invalid timestamp`, summary: "The market feed timestamp could not be verified. Do not treat these figures as current." };
  }
  if (timestamp > now + MAX_FUTURE_SKEW_MS) {
    return { ...snapshot, status: "UNAVAILABLE", source: `${snapshot.source} — future timestamp`, summary: "The market feed timestamp is materially ahead of server time. No current decision support is available." };
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
        const category = error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_failure";
        console.error("[bullseye:market-data] fetch failed", { category, urlConfigured: Boolean(url) });
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
    } catch {
      console.error("[bullseye:market-data] provider failed", { category: "provider_failure" });
    }
  }

  const httpProvider = createHttpMarketDataProvider();
  const snapshot = await httpProvider.fetchSnapshot();
  if (snapshot) return normalizeSnapshotFreshness(snapshot, options.now);

  return createUnavailableSnapshot();
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
