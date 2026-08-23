"use client";

import { useEffect } from "react";
import type { CampaignAttribution } from "../../lib/marketing-attribution.ts";

export default function CampaignVisit({ attribution }: { attribution: CampaignAttribution }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/marketing/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(attribution),
      credentials: "same-origin",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [attribution.source, attribution.medium, attribution.campaign]);
  return null;
}
