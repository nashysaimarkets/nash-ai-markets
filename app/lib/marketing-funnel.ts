export const POCKET_FUNNEL_EVENTS = [
  "founding_page_viewed",
  "founding_offer_clicked",
  "app_open_clicked",
  "checkout_started",
  "checkout_cancelled",
  "checkout_unavailable",
] as const;

export type PocketFunnelEvent = typeof POCKET_FUNNEL_EVENTS[number];

export function isPocketFunnelEvent(value: unknown): value is PocketFunnelEvent {
  return typeof value === "string" && POCKET_FUNNEL_EVENTS.includes(value as PocketFunnelEvent);
}
