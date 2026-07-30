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

export function normalizeEventTitle(title: string): string {
  const trimmed = title.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase();
  return TITLE_ALIASES[key] ?? trimmed;
}

function eventKey(event: Pick<MarketEvent, "time" | "name">): string {
  return `${event.time}|${normalizeEventTitle(event.name).toLowerCase()}`;
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
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...event,
      name: normalizeEventTitle(event.name),
    });
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
