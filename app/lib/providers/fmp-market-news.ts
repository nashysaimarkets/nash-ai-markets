type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MarketHeadline = {
  title: string;
  publishedAt: string;
  source: string;
  url: string;
  symbols: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "news", "articles", "results", "result"]) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function publishedIso(record: Record<string, unknown>): string | null {
  for (const key of ["publishedDate", "date", "datetime", "publishedAt"]) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const parsed = Date.parse(value.replace(" ", "T"));
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

/**
 * Normalize provider stock-news payloads. Headlines are never invented.
 * Only https article URLs are retained.
 */
export function normalizeStockNews(payload: unknown, limit = 8): MarketHeadline[] {
  const headlines: MarketHeadline[] = [];
  for (const record of recordsFromPayload(payload)) {
    const title = typeof record.title === "string"
      ? record.title.trim()
      : typeof record.headline === "string"
        ? record.headline.trim()
        : "";
    if (!title || title.length < 8 || title.length > 220) continue;
    const url = safeHttpsUrl(record.url ?? record.link ?? record.articleUrl);
    if (!url) continue;
    const publishedAt = publishedIso(record);
    if (!publishedAt) continue;
    const source = typeof record.site === "string"
      ? record.site.trim().slice(0, 64)
      : typeof record.publisher === "string"
        ? record.publisher.trim().slice(0, 64)
        : typeof record.source === "string"
          ? record.source.trim().slice(0, 64)
          : "Provider news";
    const symbolsRaw = record.symbol ?? record.symbols;
    const symbols = Array.isArray(symbolsRaw)
      ? symbolsRaw.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).slice(0, 4)
      : typeof symbolsRaw === "string"
        ? symbolsRaw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean).slice(0, 4)
        : [];
    headlines.push({ title, publishedAt, source, url, symbols });
    if (headlines.length >= limit) break;
  }
  return headlines;
}

export async function loadFmpStockNews(input: {
  apiKey: string;
  symbols?: string[];
  baseUrl?: string;
  limit?: number;
  fetchImpl?: FetchLike;
}): Promise<MarketHeadline[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) return [];
  const base = (input.baseUrl?.trim() || "https://financialmodelingprep.com/stable/").replace(/\/?$/, "/");
  const symbols = (input.symbols?.length ? input.symbols : ["SPY"]).map((item) => item.trim()).filter(Boolean);
  const limit = Math.max(1, Math.min(20, input.limit ?? 8));
  const url = new URL("news/stock", base);
  url.searchParams.set("symbols", symbols.join(","));
  url.searchParams.set("page", "0");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apikey", apiKey);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      // Fallback to latest feed when symbol search is unavailable on the plan.
      const latest = new URL("news/stock-latest", base);
      latest.searchParams.set("page", "0");
      latest.searchParams.set("limit", String(limit));
      latest.searchParams.set("apikey", apiKey);
      const fallback = await (input.fetchImpl ?? fetch)(latest, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (!fallback.ok) return [];
      const payload = await fallback.json().catch(() => null);
      return normalizeStockNews(payload, limit).filter((item) =>
        item.symbols.length === 0
        || item.symbols.some((symbol) => symbols.includes(symbol) || symbol === "SPX" || symbol === "ES" || symbol.startsWith("SP")),
      );
    }
    const payload = await response.json().catch(() => null);
    return normalizeStockNews(payload, limit);
  } catch {
    return [];
  }
}

export async function getConfiguredSp500News(limit = 8): Promise<MarketHeadline[]> {
  const apiKey = process.env.FMP_API_KEY?.trim() ?? "";
  if (!apiKey || /^replace|your-|example|changeme|todo|xxx/i.test(apiKey)) return [];
  return loadFmpStockNews({
    apiKey,
    symbols: ["SPY"],
    baseUrl: process.env.FMP_API_BASE_URL?.trim(),
    limit,
  });
}
