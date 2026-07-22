import type { MarketEvent } from "../market-data.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "events", "economicCalendar", "results", "result"]) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function impactToRisk(value: unknown): "HIGH" | "MED" | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("high") || text === "3") return "HIGH";
  if (text.includes("med") || text.includes("moderate") || text === "2") return "MED";
  return null;
}

function isUnitedStates(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "us" || text === "usa" || text.includes("united states") || text === "u.s.";
}

function eventTimestampMs(record: Record<string, unknown>): number | null {
  for (const key of ["date", "datetime", "eventDate", "releaseDate", "time"]) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const parsed = Date.parse(value.includes("T") || value.includes(" ") ? value.replace(" ", "T") : `${value}T12:00:00Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatEventTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/**
 * Normalize FMP economic-calendar payloads into verified MarketEvent rows.
 * Only US medium/high-impact releases are retained. Nothing is invented.
 */
export function normalizeEconomicCalendar(payload: unknown, now = Date.now()): MarketEvent[] {
  const horizonMs = now + 7 * 24 * 60 * 60_000;
  const events: Array<MarketEvent & { sort: number }> = [];
  for (const record of recordsFromPayload(payload)) {
    if (!isUnitedStates(record.country ?? record.currency ?? record.region)) continue;
    const risk = impactToRisk(record.impact ?? record.importance ?? record.priority);
    if (!risk) continue;
    const name = typeof record.event === "string"
      ? record.event.trim()
      : typeof record.title === "string"
        ? record.title.trim()
        : typeof record.name === "string"
          ? record.name.trim()
          : "";
    if (!name || name.length > 160) continue;
    const stamp = eventTimestampMs(record);
    if (stamp === null || stamp < now - 2 * 60 * 60_000 || stamp > horizonMs) continue;
    events.push({ time: formatEventTime(stamp), name, risk, sort: stamp });
  }
  return events
    .sort((left, right) => left.sort - right.sort)
    .slice(0, 10)
    .map(({ time, name, risk }) => ({ time, name, risk }));
}

export async function loadFmpEconomicCalendar(input: {
  apiKey: string;
  baseUrl?: string;
  now?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<MarketEvent[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) return [];
  const now = input.now ?? Date.now();
  const timeoutMs = Math.max(1, input.timeoutMs ?? 5_000);
  const base = (input.baseUrl?.trim() || "https://financialmodelingprep.com/stable/").replace(/\/?$/, "/");
  const from = new Date(now).toISOString().slice(0, 10);
  const to = new Date(now + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const url = new URL("economic-calendar", base);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    return normalizeEconomicCalendar(payload, now);
  } catch {
    return [];
  }
}
