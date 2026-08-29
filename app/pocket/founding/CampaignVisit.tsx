"use client";

import { useEffect } from "react";
import type { CampaignAttribution } from "../../lib/marketing-attribution.ts";

export default function CampaignVisit({ attribution: { source, medium, campaign } }: { attribution: CampaignAttribution }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/marketing/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, medium, campaign }),
      credentials: "same-origin",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [source, medium, campaign]);
  return null;
}
