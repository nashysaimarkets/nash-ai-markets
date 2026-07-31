/**
 * Canonical economic-event display helpers (presentation only).
 * Deduplicate by normalized title + time; never invent events.
 */

import type { MarketEvent } from "../../lib/market-data.ts";

const TITLE_ALIASES: Record<string, string> = {
  "press conference": "Fed Press Conference",
  "fed press conference": "Fed Press Conference",
  "fomc press conference": "Fed Press Conference",
};

export function normalizeEventTitle(title: unknown): string {
  if (typeof title !== "string") return "";
  const trimmed = title.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase();
  return TITLE_ALIASES[key] ?? trimmed;
}

/**
 * Calendar rows arrive from an external provider and are not schema-guaranteed
 * per row. Impact that cannot be verified is reported as UNKNOWN rather than
 * being defaulted to a rating the provider never supplied.
 */
export type VerifiedEventRisk = "HIGH" | "MED" | "UNKNOWN";

export function verifiedEventRisk(value: unknown): VerifiedEventRisk {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) return "UNKNOWN";
  if (text.includes("high") || text === "3") return "HIGH";
  if (text.includes("med") || text.includes("moderate") || text === "2") return "MED";
  return "UNKNOWN";
}

/** Customer-facing impact wording. Never presents an unverified rating as verified. */
export function verifiedEventRiskLabel(risk: unknown): string {
  if (risk === "HIGH") return "HIGH impact";
  if (risk === "MED") return "MED impact";
  return "Impact not verified";
}

function eventKey(event: Pick<MarketEvent, "time" | "name">): string {
  return `${typeof event.time === "string" ? event.time : ""}|${normalizeEventTitle(event.name).toLowerCase()}`;
}

/** Prefer authoritative ISO `at`, then fall back to parsing display `time`. */
export function eventTimestampMs(event: Pick<MarketEvent, "time" | "at">): number | null {
  if (event.at) {
    const stamped = Date.parse(event.at);
    if (Number.isFinite(stamped)) return stamped;
  }
  const parsed = Date.parse(event.time);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Format a verified event for customer UI in Europe/London with timezone label. */
export function formatVerifiedEventWhen(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

/** Deduplicate verified events for display; preserve first occurrence order. */
export function dedupeVerifiedEvents(events: readonly MarketEvent[]): MarketEvent[] {
  const seen = new Set<string>();
  const out: MarketEvent[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const name = normalizeEventTitle(event.name);
    // An unnamed row cannot be presented as a verified catalyst.
    if (!name) continue;
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...event, name });
  }
  return out;
}

/**
 * Upcoming verified events only (timestamp > now).
 * Events without a parseable timestamp are excluded — never treat opaque labels as future.
 */
export function upcomingVerifiedEvents(
  events: readonly MarketEvent[],
  now = Date.now(),
  limit = 12,
): MarketEvent[] {
  return dedupeVerifiedEvents(events)
    .map((event) => ({ event, timestamp: eventTimestampMs(event) }))
    .filter((item): item is { event: MarketEvent; timestamp: number } =>
      item.timestamp != null && item.timestamp > now)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(0, Math.max(0, limit))
    .map(({ event }) => event);
}

export function nextVerifiedEvents(
  events: readonly MarketEvent[],
  limit: number,
  now = Date.now(),
): MarketEvent[] {
  return upcomingVerifiedEvents(events, now, limit);
}

/** Deterministic release families that may share one event-risk window. */
function releaseFamily(name: string): "employment-cost" | null {
  return /employment cost/i.test(name) ? "employment-cost" : null;
}

function isFamilyPrimary(name: string, family: "employment-cost"): boolean {
  if (family === "employment-cost") {
    const lower = name.toLowerCase();
    return /employment cost index/i.test(name) && !/wages|benefits/.test(lower);
  }
  return true;
}

function familyComponentLabel(name: string): string {
  const lower = name.toLowerCase();
  if (/wages/.test(lower)) return "Wages QoQ";
  if (/benefits/.test(lower)) return "Benefits QoQ";
  return normalizeEventTitle(name);
}

export type GroupedVerifiedEvent = {
  time: string;
  at?: string;
  name: string;
  risk: VerifiedEventRisk;
  includes: Array<{ name: string; risk: VerifiedEventRisk }>;
};

/**
 * Group same-timestamp Employment Cost components under the primary Index release.
 * Unrelated events stay standalone. Never invents relationships across families.
 */
export function groupVerifiedEvents(
  events: readonly MarketEvent[],
  now = Date.now(),
  limit = 12,
): GroupedVerifiedEvent[] {
  const upcoming = upcomingVerifiedEvents(events, now, Math.max(limit * 4, 24));
  const used = new Set<number>();
  const groups: GroupedVerifiedEvent[] = [];

  for (let index = 0; index < upcoming.length; index += 1) {
    if (used.has(index)) continue;
    const event = upcoming[index]!;
    const stamp = eventTimestampMs(event);
    const family = releaseFamily(event.name);
    const displayTime = stamp != null ? formatVerifiedEventWhen(stamp) : event.time;

    if (!family || stamp == null) {
      used.add(index);
      groups.push({
        time: displayTime,
        at: stamp != null ? new Date(stamp).toISOString() : event.at,
        name: event.name,
        risk: verifiedEventRisk(event.risk),
        includes: [],
      });
      if (groups.length >= limit) break;
      continue;
    }

    const members: MarketEvent[] = [];
    for (let cursor = index; cursor < upcoming.length; cursor += 1) {
      if (used.has(cursor)) continue;
      const candidate = upcoming[cursor]!;
      if (eventTimestampMs(candidate) !== stamp) continue;
      if (releaseFamily(candidate.name) !== family) continue;
      used.add(cursor);
      members.push(candidate);
    }

    const primary = members.find((item) => isFamilyPrimary(item.name, family)) ?? members[0]!;
    const includes = members
      .filter((item) => item !== primary)
      .map((item) => ({ name: familyComponentLabel(item.name), risk: verifiedEventRisk(item.risk) }));
    const quarter = members
      .map((item) => item.name.match(/\b(Q[1-4])\b/i)?.[1]?.toUpperCase())
      .find(Boolean);

    groups.push({
      time: stamp != null ? formatVerifiedEventWhen(stamp) : primary.time,
      at: stamp != null ? new Date(stamp).toISOString() : primary.at,
      name:
        family === "employment-cost"
          ? quarter
            ? `Employment Cost Index (${quarter})`
            : "Employment Cost Index"
          : primary.name,
      risk: members.some((item) => verifiedEventRisk(item.risk) === "HIGH")
        ? "HIGH"
        : verifiedEventRisk(primary.risk),
      includes,
    });
    if (groups.length >= limit) break;
  }

  return groups;
}
