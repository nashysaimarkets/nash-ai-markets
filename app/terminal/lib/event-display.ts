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

export function nextVerifiedEvents(events: readonly MarketEvent[], limit: number): MarketEvent[] {
  return dedupeVerifiedEvents(events).slice(0, Math.max(0, limit));
}
