export const CAMPAIGN_SOURCES = ["instagram", "tiktok", "x", "youtube", "snapchat", "linkedin", "direct"] as const;

export type CampaignSource = typeof CAMPAIGN_SOURCES[number];

export type CampaignAttribution = {
  source: CampaignSource;
  medium: string;
  campaign: string;
};

const SAFE_TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function safeToken(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return SAFE_TOKEN.test(normalized) ? normalized : fallback;
}

export function campaignAttribution(input: {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}): CampaignAttribution {
  const requestedSource = safeToken(input.utm_source, "direct");
  const source = CAMPAIGN_SOURCES.includes(requestedSource as CampaignSource)
    ? requestedSource as CampaignSource
    : "direct";
  return {
    source,
    medium: safeToken(input.utm_medium, source === "direct" ? "none" : "social"),
    campaign: safeToken(input.utm_campaign, "founding650"),
  };
}

export function campaignQuery(attribution: CampaignAttribution): string {
  return new URLSearchParams({
    utm_source: attribution.source,
    utm_medium: attribution.medium,
    utm_campaign: attribution.campaign,
  }).toString();
}
