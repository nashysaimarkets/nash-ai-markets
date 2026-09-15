"use client";

import { growthAttribution, type GrowthEvent, type GrowthFlow } from "../lib/pocket-growth.ts";
import { isAppleNativeApp } from "./apple-storekit";

export const USAGE_PREFERENCE = "pocket-usage-counts-disabled";
let disabledThisPage = false;
const recorded = new Set<string>();

export function usageDisabled() {
  if (typeof window === "undefined") return true;
  try { return disabledThisPage || localStorage.getItem(USAGE_PREFERENCE) === "1" || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true; }
  catch { return true; }
}

export function setUsageDisabled(disabled: boolean) {
  disabledThisPage = disabled;
  try { if (disabled) localStorage.setItem(USAGE_PREFERENCE, "1"); else localStorage.removeItem(USAGE_PREFERENCE); } catch { /* The current-page preference still applies. */ }
}

export function trackGrowth(event: GrowthEvent, options: { flow?: GrowthFlow; durationMs?: number; once?: string } = {}) {
  try {
    if (usageDisabled() || (options.once && recorded.has(options.once))) return;
    if (options.once) { if (recorded.size >= 200) recorded.clear(); recorded.add(options.once); }
    const params = new URLSearchParams(window.location.search);
    const body = { event, platform: isAppleNativeApp() ? "apple" : "web", ...growthAttribution(params), flow: options.flow ?? "browse", duration_ms: options.durationMs ?? 0, is_test: params.get("pb_test") === "1" || /^(localhost|127\.0\.0\.1|terminal\.local)$/.test(window.location.hostname) };
    // One attempt, no retry or await: measurements never hold up a scan or navigation.
    void fetch("/api/pocket/activity", { method: "POST", headers: { "content-type": "application/json" }, credentials: "omit", keepalive: true, body: JSON.stringify(body) }).catch(() => undefined);
  } catch { /* Optional statistics cannot interrupt the product. */ }
}

export function sampleDestination() {
  if (typeof window === "undefined") return "/pocket?demo=1";
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams({ demo: "1", utm_source: growthAttribution(current).source, utm_campaign: growthAttribution(current).campaign });
  if (current.get("pb_test") === "1") params.set("pb_test", "1");
  return `/pocket?${params}`;
}
