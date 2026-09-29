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
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
      const [date, clock] = trimmed.split(" ");
      const [year, month, day] = date!.split("-").map(Number);
      const [hour, minute, second = 0] = clock!.split(":").map(Number);
      const intendedWallClock = Date.UTC(year!, month! - 1, day!, hour!, minute!, second!);
      let candidate = intendedWallClock;
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const parts = Object.fromEntries(formatter.formatToParts(candidate)
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)]));
        candidate += intendedWallClock - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      }
      return candidate;
    }
    const parsed = Date.parse(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00Z`);
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
    events.push({
      time: formatEventTime(stamp),
      name,
      risk,
      at: new Date(stamp).toISOString(),
      sort: stamp,
    });
  }
  return events
    .sort((left, right) => left.sort - right.sort)
    .slice(0, 10)
    .map(({ time, name, risk, at }) => ({ time, name, risk, at }));
}

export async function loadFmpEconomicCalendar(input: {
  apiKey: string;
  baseUrl?: string;
  now?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<MarketEvent[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) return [];
  const now = input.now ?? Date.now();
  const timeoutMs = Math.max(1, input.timeoutMs ?? 5_000);
  const base = new URL((input.baseUrl?.trim() || "https://financialmodelingprep.com/stable/"));
  const baseQuery = new URLSearchParams(base.search);
  base.search = "";
  if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`;
  const from = new Date(now).toISOString().slice(0, 10);
  const to = new Date(now + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const url = new URL("economic-calendar", base);
  baseQuery.forEach((value, key) => url.searchParams.append(key, value));
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      cache: "no-store",
      signal: input.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`[fmp-economic-calendar] request rejected ${JSON.stringify({ httpStatus: response.status })}`);
      return [];
    }
    const payload = await response.json().catch(() => null);
    return normalizeEconomicCalendar(payload, now);
  } catch (error) {
    console.error(
      `[fmp-economic-calendar] request failed ${JSON.stringify({
        error: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      })}`,
    );
    return [];
  }
}
