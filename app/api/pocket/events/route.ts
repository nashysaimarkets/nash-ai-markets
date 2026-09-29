import { NextResponse } from "next/server";
import { getVerifiedMacroContext } from "../../../lib/verified-macro-context";
import { loadFmpEconomicCalendar } from "../../../lib/providers/fmp-economic-calendar";
import type { SupplementalMarketEvent } from "../../../lib/macro-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProviderRow = Record<string, unknown>;
type StockEvent = { id: string; type: "EARNINGS" | "DIVIDEND" | "SPLIT"; date: string; detail: string; source: string };

function text(row: ProviderRow, key: string) {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function future(date: string) {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && timestamp >= Date.now() - 86_400_000;
}

async function companyEvents(symbol: string) {
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) return NextResponse.json({ error: "A valid listed-company ticker is required." }, { status: 400 });
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Corporate events feed is not connected." }, { status: 503 });
  const endpoints = [
    ["EARNINGS", `https://financialmodelingprep.com/stable/earnings?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`],
    ["DIVIDEND", `https://financialmodelingprep.com/stable/dividends?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`],
    ["SPLIT", `https://financialmodelingprep.com/stable/splits?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`],
  ] as const;
  try {
    const responses = await Promise.all(endpoints.map(async ([type, url]) => {
      const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 21_600 } });
      if (!response.ok) return [] as StockEvent[];
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows)) return [] as StockEvent[];
      return rows.flatMap((value, index): StockEvent[] => {
        if (!value || typeof value !== "object") return [];
        const row = value as ProviderRow;
        const returnedSymbol = text(row, "symbol").trim().toUpperCase();
        if (returnedSymbol !== symbol) return [];
        const date = text(row, "date") || text(row, "paymentDate");
        if (!future(date)) return [];
        let detail = "Scheduled company event";
        if (type === "EARNINGS") detail = text(row, "epsEstimated") ? `Estimated EPS ${text(row, "epsEstimated")}` : "Earnings date";
        if (type === "DIVIDEND") detail = text(row, "dividend") ? `Dividend ${text(row, "dividend")}` : "Dividend date";
        if (type === "SPLIT") detail = text(row, "numerator") && text(row, "denominator") ? `${text(row, "numerator")}:${text(row, "denominator")} split` : "Stock split";
        return [{ id: `${type}-${symbol}-${date}-${index}`, type, date, detail, source: "Financial Modeling Prep" }];
      });
    }));
    const events = responses.flat().sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 8);
    return NextResponse.json({ symbol, events, source: "Financial Modeling Prep" }, { headers: { "cache-control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Corporate events are temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  if (symbol) return companyEvents(symbol);
  const apiKey = process.env.FMP_API_KEY?.trim() ?? "";
  const [macroContext, providerRows] = await Promise.all([
    getVerifiedMacroContext({ route: "/api/pocket/events", signal: request.signal }),
    loadFmpEconomicCalendar({ apiKey, baseUrl: process.env.FMP_API_BASE_URL?.trim(), signal: request.signal }),
  ]);
  const marketEvents: SupplementalMarketEvent[] = providerRows.map((event, index) => ({
    id: `fmp-${event.at}-${index}`,
    name: event.name,
    scheduledAt: event.at ?? "",
    risk: event.risk,
    source: "Financial Modeling Prep",
  })).filter((event) => Boolean(event.scheduledAt));
  return NextResponse.json({ macroContext, marketEvents }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
