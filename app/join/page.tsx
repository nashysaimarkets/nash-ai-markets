import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { campaignAttribution, campaignQuery } from "../lib/marketing-attribution.ts";

export const metadata: Metadata = {
  title: "Join Pocket Bullseye",
  robots: { index: false, follow: false },
};

export default async function JoinPocketBullseye({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const attribution = campaignAttribution({
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_campaign: params.utm_campaign,
  });
  redirect(`/pocket/founding?${campaignQuery(attribution)}#founding`);
}
