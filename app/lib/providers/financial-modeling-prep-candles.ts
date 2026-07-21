import { createAsyncKeyedTtlCache } from "../server/async-ttl-cache.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type CandleFreshness = "delayed" | "previous_session" | "market_closed" | "stale" | "unavailable";
export type CandleTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type CandleCacheStatus = "hit" | "miss" | "coalesced" | "disabled";

export type VerifiedCandleSeries = {
  symbol: string;
  contract: string;
  instrumentName: string;
  exchange: string;
  instrumentDetail: string;
  timeframe: CandleTimeframe;
  classification: "delayed" | "end_of_day" | "previous_session" | "market_closed";
  dataAgeMs: number | null;
  provider: "Financial Modeling Prep";
  status: CandleFreshness;
  asOf: string | null;
  candles: OhlcvPoint[];
  cache: { status: CandleCacheStatus; ttlMs: number; requestsAvoided: number };
  failureCategory: "not_configured" | "authentication" | "entitlement" | "rate_limit" | "provider" | "schema" | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type LoadOptions = { apiKey: string; symbol: string; timeframe?: CandleTimeframe; baseUrl?: string; now?: number; fetchImpl?: FetchLike; maxCandles?: number };

const CACHE_TTL_MS = 60_000;
const MAX_CANDLES = 200;
const MAX_SOURCE_CANDLES = 800;
const cache = createAsyncKeyedTtlCache<VerifiedCandleSeries>({ ttlMs: CACHE_TTL_MS, maxEntries: 12, isFailure: (value) => value.status === "unavailable" });

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replaceAll(",", "")) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value >= 1e12 ? value / 1000 : value);
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return Math.round(Date.parse(`${trimmed}T00:00:00Z`) / 1000);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [date, clock] = trimmed.split(" ");
    const [year, month, day] = date!.split("-").map(Number); const [hour, minute, second] = clock!.split(":").map(Number);
    const intendedUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!, second!);
    let candidate = intendedUtc;
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
      candidate += intendedUtc - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    }
    return Math.round(candidate / 1000);
  }
  if (!/(?:Z|[+-]\d\d:?\d\d)$/.test(trimmed)) return null;
  const parsed = Date.parse(trimmed.replace(" ", "T"));
  return Number.isFinite(parsed) ? Math.round(parsed / 1000) : null;
}

export function normalizeFmpCandles(payload: unknown, maxCandles = MAX_CANDLES): OhlcvPoint[] {
  const records = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : payload && typeof payload === "object" && Array.isArray((payload as { historical?: unknown }).historical) ? (payload as { historical: unknown[] }).historical : [];
  const unique = new Map<number, OhlcvPoint>();
  for (const item of records) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const time = timestamp(record.timestamp ?? record.date ?? record.datetime);
    const open = finite(record.open); const high = finite(record.high); const low = finite(record.low); const close = finite(record.close); const volume = finite(record.volume) ?? 0;
    if (time === null || open === null || high === null || low === null || close === null || volume < 0 || low > Math.min(open, close) || high < Math.max(open, close)) continue;
    unique.set(time, { time, open, high, low, close, volume });
  }
  return [...unique.values()].sort((left, right) => left.time - right.time).slice(-Math.max(1, Math.min(MAX_SOURCE_CANDLES, maxCandles)));
}

function empty(symbol: string, timeframe: CandleTimeframe, category: VerifiedCandleSeries["failureCategory"]): VerifiedCandleSeries {
  const es = symbol === "ESUSD";
  return {
    symbol,
    contract: es ? "S&P 500 futures reference series" : "Configured market series",
    instrumentName: es ? "S&P 500 futures reference series" : "Configured market series",
    exchange: "Verified delayed provider series",
    instrumentDetail: es
      ? "ESUSD reference series from the configured market-data provider. Delayed quotes only — never treated as live."
      : "Configured symbol from the verified market-data provider.",
    timeframe,
    classification: timeframe === "1d" ? "end_of_day" : "delayed",
    dataAgeMs: null,
    provider: "Financial Modeling Prep",
    status: "unavailable",
    asOf: null,
    candles: [],
    cache: { status: "disabled", ttlMs: CACHE_TTL_MS, requestsAvoided: 0 },
    failureCategory: category,
  };
}

export function determineCandleFreshness(candles: OhlcvPoint[], now: number, timeframe: CandleTimeframe = "5m"): Pick<VerifiedCandleSeries, "status" | "asOf" | "dataAgeMs" | "classification"> {
  const latest = candles.at(-1);
  if (!latest) return { status: "unavailable", asOf: null, dataAgeMs: null, classification: timeframe === "1d" ? "end_of_day" : "delayed" };
  const age = now - latest.time * 1000;
  if (age < 0) return { status: "unavailable", asOf: null, dataAgeMs: null, classification: timeframe === "1d" ? "end_of_day" : "delayed" };
  const asOf = new Date(latest.time * 1000).toISOString();
  if (timeframe === "1d") {
    const status: CandleFreshness = age <= 4 * 24 * 60 * 60_000 ? "delayed" : "stale";
    return { status, asOf, dataAgeMs: age, classification: "end_of_day" };
  }
  // Intraday FMP series is never labelled live.
  if (age <= 60 * 60_000) return { status: "delayed", asOf, dataAgeMs: age, classification: "delayed" };
  if (age <= 18 * 60 * 60_000) return { status: "previous_session", asOf, dataAgeMs: age, classification: "previous_session" };
  if (age <= 72 * 60 * 60_000) return { status: "market_closed", asOf, dataAgeMs: age, classification: "market_closed" };
  return { status: "stale", asOf, dataAgeMs: age, classification: "market_closed" };
}

const source = (timeframe: CandleTimeframe) => timeframe === "1d" ? { path: "historical-price-eod/full", days: 370 } : { path: `historical-chart/${({ "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1hour", "4h": "4hour" } as const)[timeframe]}`, days: timeframe === "1m" ? 1 : timeframe === "5m" || timeframe === "15m" ? 3 : 45 };

function aggregateFourHour(candles: OhlcvPoint[]) {
  const groups = new Map<number, OhlcvPoint[]>();
  for (const candle of candles) { const bucket = Math.floor(candle.time / 14_400) * 14_400; groups.set(bucket, [...(groups.get(bucket) ?? []), candle]); }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([time, values]) => ({ time, open: values[0]!.open, high: Math.max(...values.map((v) => v.high)), low: Math.min(...values.map((v) => v.low)), close: values.at(-1)!.close, volume: values.reduce((sum, v) => sum + v.volume, 0) }));
}

export async function loadFmpCandles({ apiKey, symbol, timeframe = "15m", baseUrl = "https://financialmodelingprep.com/stable/", now = Date.now(), fetchImpl = fetch, maxCandles = MAX_CANDLES }: LoadOptions): Promise<VerifiedCandleSeries> {
  if (!apiKey.trim() || !symbol.trim()) return empty(symbol, timeframe, "not_configured");
  const endpoint = source(timeframe);
  const from = new Date(now - endpoint.days * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const to = new Date(now).toISOString().slice(0, 10);
  const url = new URL(endpoint.path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  let response: Response;
  try { response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) }); }
  catch { return empty(symbol, timeframe, "provider"); }
  if (response.status === 401 || response.status === 403) return empty(symbol, timeframe, "authentication");
  if (response.status === 402) return empty(symbol, timeframe, "entitlement");
  if (response.status === 429) return empty(symbol, timeframe, "rate_limit");
  if (!response.ok) return empty(symbol, timeframe, "provider");
  const payload = await response.json().catch(() => null) as unknown;
  const normalized = normalizeFmpCandles(payload, timeframe === "4h" ? maxCandles * 4 : maxCandles);
  const candles = (timeframe === "4h" ? aggregateFourHour(normalized) : normalized).slice(-maxCandles);
  if (!candles.length) return empty(symbol, timeframe, "schema");
  return { ...empty(symbol, timeframe, null), ...determineCandleFreshness(candles, now, timeframe), candles, cache: { status: "miss", ttlMs: CACHE_TTL_MS, requestsAvoided: 0 }, failureCategory: null };
}

function configuredApiKey(): string | null {
  const apiKey = process.env.FMP_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  // Reject documented placeholders so customer charts fail closed instead of calling FMP with junk credentials.
  if (/^replace|your-|example|changeme|todo|xxx/i.test(apiKey)) return null;
  return apiKey;
}

async function loadFixtureCandles(symbol: string, timeframe: CandleTimeframe, now: number): Promise<VerifiedCandleSeries | null> {
  // Never serve fixtures on Vercel preview/production or any production Node build.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) return null;
  const configured = process.env.BULLSEYE_CANDLE_FIXTURE_PATH?.trim();
  const { access, readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const candidates = [configured, resolve(process.cwd(), "fixtures/candles-esusd-5m.json")].filter((value): value is string => Boolean(value?.trim()));
  for (const fixturePath of candidates) {
    try {
      await access(fixturePath);
      const payload = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
      const normalized = normalizeFmpCandles(payload, timeframe === "4h" ? MAX_CANDLES * 4 : MAX_CANDLES);
      const candles = (timeframe === "4h" ? aggregateFourHour(normalized) : normalized).slice(-MAX_CANDLES);
      if (!candles.length) return empty(symbol, timeframe, "schema");
      return {
        ...empty(symbol, timeframe, null),
        ...determineCandleFreshness(candles, now, timeframe),
        candles,
        instrumentDetail: "Non-production layout fixture · not live market data",
        cache: { status: "disabled", ttlMs: CACHE_TTL_MS, requestsAvoided: 0 },
        failureCategory: null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Customer-safe candle payload: strips cache internals before browser/API delivery. */
export type CustomerCandleSeries = Omit<VerifiedCandleSeries, "cache">;

export function toCustomerCandleSeries(series: VerifiedCandleSeries): CustomerCandleSeries {
  const { cache, ...customer } = series;
  void cache;
  return customer;
}

export async function getConfiguredFmpCandles(timeframe: CandleTimeframe = "5m", now = Date.now()): Promise<VerifiedCandleSeries> {
  const symbol = process.env.FMP_SP500_FUTURES_SYMBOL?.trim() || "ESUSD";
  const apiKey = configuredApiKey();
  // Fixture is a non-production fallback only — never preferred over a real key, never in production.
  if (!apiKey) {
    const fixture = await loadFixtureCandles(symbol, timeframe, now);
    if (fixture) return fixture;
    return empty(symbol, timeframe, "not_configured");
  }
  const key = `${symbol}:${timeframe}:${new Date(now).toISOString().slice(0, 10)}`;
  const before = cache.getStats();
  const value = await cache.get(key, () => loadFmpCandles({ apiKey, symbol, timeframe, baseUrl: process.env.FMP_API_BASE_URL?.trim(), now }));
  const after = cache.getStats();
  const status: CandleCacheStatus = after.loads > before.loads ? "miss" : after.coalesced > before.coalesced ? "coalesced" : "hit";
  return { ...value, cache: { status, ttlMs: CACHE_TTL_MS, requestsAvoided: after.hits + after.coalesced } };
}

export function getCandleCacheDiagnostics() { return cache.getStats(); }
