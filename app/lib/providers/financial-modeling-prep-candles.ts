import { createAsyncKeyedTtlCache } from "../server/async-ttl-cache.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

export type CandleFreshness = "live" | "delayed" | "stale" | "unavailable";
export type CandleCacheStatus = "hit" | "miss" | "coalesced" | "disabled";

export type VerifiedCandleSeries = {
  symbol: string;
  contract: string;
  timeframe: "5m";
  provider: "Financial Modeling Prep";
  status: CandleFreshness;
  asOf: string | null;
  candles: OhlcvPoint[];
  cache: { status: CandleCacheStatus; ttlMs: number; requestsAvoided: number };
  failureCategory: "not_configured" | "authentication" | "entitlement" | "rate_limit" | "provider" | "schema" | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type LoadOptions = { apiKey: string; symbol: string; baseUrl?: string; now?: number; fetchImpl?: FetchLike; maxCandles?: number };

const CACHE_TTL_MS = 60_000;
const MAX_CANDLES = 500;
const cache = createAsyncKeyedTtlCache<VerifiedCandleSeries>({ ttlMs: CACHE_TTL_MS, maxEntries: 12, isFailure: (value) => value.status === "unavailable" });

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replaceAll(",", "")) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value >= 1e12 ? value / 1000 : value);
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = /(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed / 1000) : null;
}

export function normalizeFmpCandles(payload: unknown, maxCandles = MAX_CANDLES): OhlcvPoint[] {
  const records = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : [];
  const unique = new Map<number, OhlcvPoint>();
  for (const item of records) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const time = timestamp(record.timestamp ?? record.date ?? record.datetime);
    const open = finite(record.open); const high = finite(record.high); const low = finite(record.low); const close = finite(record.close); const volume = finite(record.volume) ?? 0;
    if (time === null || open === null || high === null || low === null || close === null || volume < 0 || low > Math.min(open, close) || high < Math.max(open, close)) continue;
    unique.set(time, { time, open, high, low, close, volume });
  }
  return [...unique.values()].sort((left, right) => left.time - right.time).slice(-Math.max(1, Math.min(MAX_CANDLES, maxCandles)));
}

function empty(symbol: string, category: VerifiedCandleSeries["failureCategory"]): VerifiedCandleSeries {
  return { symbol: "ES", contract: symbol, timeframe: "5m", provider: "Financial Modeling Prep", status: "unavailable", asOf: null, candles: [], cache: { status: "disabled", ttlMs: CACHE_TTL_MS, requestsAvoided: 0 }, failureCategory: category };
}

export function determineCandleFreshness(candles: OhlcvPoint[], now: number): Pick<VerifiedCandleSeries, "status" | "asOf"> {
  const latest = candles.at(-1);
  if (!latest) return { status: "unavailable", asOf: null };
  const age = now - latest.time * 1000;
  const status: CandleFreshness = age <= 10 * 60_000 ? "live" : age <= 60 * 60_000 ? "delayed" : "stale";
  return { status, asOf: new Date(latest.time * 1000).toISOString() };
}

export async function loadFmpCandles({ apiKey, symbol, baseUrl = "https://financialmodelingprep.com/stable/", now = Date.now(), fetchImpl = fetch, maxCandles = MAX_CANDLES }: LoadOptions): Promise<VerifiedCandleSeries> {
  if (!apiKey.trim() || !symbol.trim()) return empty(symbol, "not_configured");
  const from = new Date(now - 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const to = new Date(now).toISOString().slice(0, 10);
  const url = new URL("historical-chart/5min", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  let response: Response;
  try { response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) }); }
  catch { return empty(symbol, "provider"); }
  if (response.status === 401 || response.status === 403) return empty(symbol, "authentication");
  if (response.status === 402) return empty(symbol, "entitlement");
  if (response.status === 429) return empty(symbol, "rate_limit");
  if (!response.ok) return empty(symbol, "provider");
  const payload = await response.json().catch(() => null) as unknown;
  const candles = normalizeFmpCandles(payload, maxCandles);
  if (!candles.length) return empty(symbol, "schema");
  return { symbol: "ES", contract: symbol, timeframe: "5m", provider: "Financial Modeling Prep", ...determineCandleFreshness(candles, now), candles, cache: { status: "miss", ttlMs: CACHE_TTL_MS, requestsAvoided: 0 }, failureCategory: null };
}

export async function getConfiguredFmpCandles(now = Date.now()): Promise<VerifiedCandleSeries> {
  const apiKey = process.env.FMP_API_KEY?.trim();
  const symbol = process.env.FMP_SP500_FUTURES_SYMBOL?.trim() || "ESUSD";
  if (!apiKey) return empty(symbol, "not_configured");
  const key = `${symbol}:5m:${new Date(now).toISOString().slice(0, 10)}`;
  const before = cache.getStats();
  const value = await cache.get(key, () => loadFmpCandles({ apiKey, symbol, baseUrl: process.env.FMP_API_BASE_URL?.trim(), now }));
  const after = cache.getStats();
  const status: CandleCacheStatus = after.loads > before.loads ? "miss" : after.coalesced > before.coalesced ? "coalesced" : "hit";
  return { ...value, cache: { status, ttlMs: CACHE_TTL_MS, requestsAvoided: after.hits + after.coalesced } };
}

export function getCandleCacheDiagnostics() { return cache.getStats(); }
