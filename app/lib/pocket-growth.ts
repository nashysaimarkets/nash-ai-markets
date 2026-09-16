/** Aggregate activity only: no customer, device, session or chart identifiers. */
export const GROWTH_EVENTS = ["introduction_viewed", "app_opened", "sample_viewed", "app_store_clicked", "chart_uploaded", "scan_started", "scan_completed", "scan_failed", "paywall_viewed", "purchase_started", "purchase_completed", "purchase_incomplete", "purchase_failed", "restore_completed", "evidence_opened", "timeframe_opened", "decision_saved", "review_started", "review_completed", "notebook_opened", "note_saved", "backup_exported", "backup_restored", "scan_prepared_single", "scan_prepared_multi", "scan_response_single", "scan_response_multi", "scan_verified_single", "scan_verified_multi"] as const;
export type GrowthEvent = typeof GROWTH_EVENTS[number];
export const GROWTH_SOURCES = ["direct", "instagram", "tiktok", "x", "youtube", "snapchat", "linkedin", "tipseason", "launchingnext", "aisuperhub", "aitools", "insidr", "macstories", "appadvice", "newsletter", "other"] as const;
export const GROWTH_CAMPAIGNS = ["discovery", "first10", "founding650", "directory", "indices", "forex", "review", "other"] as const;
export const GROWTH_FLOWS = ["browse", "sample", "web", "free", "paid"] as const;
export type GrowthFlow = typeof GROWTH_FLOWS[number];
export type GrowthPayload = { event: GrowthEvent; platform: "web" | "apple"; source: string; campaign: string; flow: GrowthFlow; is_test: boolean; duration_ms: number };
const member = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === "string" && values.includes(value as T);

export function growthAttribution(params: URLSearchParams, pathname = "") {
  const source = params.get("utm_source")?.toLowerCase();
  const pageCampaign = pathname.match(/^\/pocket-bullseye\/(indices|forex|review)\/?$/)?.[1];
  const campaign = params.get("utm_campaign")?.toLowerCase() || pageCampaign;
  return { source: member(GROWTH_SOURCES, source) ? source : source ? "other" : "direct", campaign: member(GROWTH_CAMPAIGNS, campaign) ? campaign : campaign ? "other" : "discovery" };
}

export function normaliseGrowthPayload(value: unknown): GrowthPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!member(GROWTH_EVENTS, body.event) || !member(["web", "apple"], body.platform) || !member(GROWTH_FLOWS, body.flow)) return null;
  if ((body.event.startsWith("purchase_") || body.event === "paywall_viewed" || body.event === "restore_completed") && body.platform !== "apple") return null;
  if (body.event.startsWith("scan_") && body.flow === "sample") return null;
  return {
    event: body.event, platform: body.platform,
    source: member(GROWTH_SOURCES, body.source) ? body.source : "other",
    campaign: member(GROWTH_CAMPAIGNS, body.campaign) ? body.campaign : "other",
    flow: body.flow, is_test: body.is_test === true,
    duration_ms: typeof body.duration_ms === "number" && Number.isFinite(body.duration_ms) ? Math.max(0, Math.min(600_000, Math.round(body.duration_ms))) : 0,
  };
}
