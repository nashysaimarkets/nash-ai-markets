"use client";

import { useEffect } from "react";
import { campaignAttribution, type CampaignAttribution, type CampaignSource } from "../../lib/marketing-attribution.ts";
import { isPocketFunnelEvent, type PocketFunnelEvent } from "../../lib/marketing-funnel.ts";

const MULTI_PART_PUBLIC_SUFFIXES = new Set(["co.uk", "com.au", "co.nz", "co.in", "com.br", "com.mx"]);

function referrerSource(referrer: string, currentHost: string): CampaignSource | null {
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const current = currentHost.toLowerCase().replace(/^www\./, "");
    if (host === current || host.endsWith("." + current) || current.endsWith("." + host)) return null;
    const labels = host.split(".").filter(Boolean);
    if (labels.length < 2) return null;
    const suffix = labels.slice(-2).join(".");
    const sourceLabel = MULTI_PART_PUBLIC_SUFFIXES.has(suffix) ? labels.at(-3) : labels.at(-2);
    if (!sourceLabel) return null;
    return campaignAttribution({ utm_source: sourceLabel }).source;
  } catch {
    return null;
  }
}

function queueEvents(events: PocketFunnelEvent[], attribution: CampaignAttribution) {
  const body = JSON.stringify({
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    events,
  });
  const payload = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon && navigator.sendBeacon("/api/marketing/visit", payload)) return;
  void fetch("/api/marketing/visit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export default function CampaignVisit({ attribution, outcome }: {
  attribution: CampaignAttribution;
  outcome?: PocketFunnelEvent;
}) {
  useEffect(() => {
    const referral = attribution.source === "direct"
      ? referrerSource(document.referrer, window.location.hostname)
      : null;
    const captured = referral
      ? { ...attribution, source: referral, medium: "referral" }
      : attribution;
    const initialEvents: PocketFunnelEvent[] = ["founding_page_viewed"];
    if (outcome && isPocketFunnelEvent(outcome)) initialEvents.push(outcome);
    queueEvents(initialEvents, captured);

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-pb-growth-click]")
        : null;
      const eventName = target?.dataset.pbGrowthClick;
      if (isPocketFunnelEvent(eventName)) queueEvents([eventName], captured);
    };
    const onSubmit = (event: Event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLFormElement>("form[data-pb-growth-submit]")
        : null;
      const eventName = target?.dataset.pbGrowthSubmit;
      if (isPocketFunnelEvent(eventName)) queueEvents([eventName], captured);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [attribution.source, attribution.medium, attribution.campaign, outcome]);
  return null;
}
