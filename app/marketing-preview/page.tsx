import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPreviewSurface } from "./components/MarketingPreviewSurface.tsx";
import { RealDashboardPreview } from "./components/RealDashboardPreview.tsx";
import { RealBriefPreview } from "./components/RealBriefPreview.tsx";
import { RealTerminalPreview } from "./components/RealTerminalPreview.tsx";
import {
  MARKETING_PREVIEW_STATES,
  getMarketingPreviewFixture,
  type MarketingPreviewStateId,
} from "./lib/illustrative-fixtures.ts";
import { resolveMarketingPreviewPage } from "./lib/page-sections.ts";
import "./marketing-preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Marketing preview | NASH AI Markets",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function resolveState(raw: string | string[] | undefined): MarketingPreviewStateId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (MARKETING_PREVIEW_STATES as readonly string[]).includes(value)) {
    return value as MarketingPreviewStateId;
  }
  return "wait";
}

export default async function MarketingPreviewPage({ searchParams }: PageProps) {
  // Hard production guard — this route must never render on Vercel Production.
  if (process.env.VERCEL_ENV === "production") notFound();

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const initialState = resolveState(params?.state);
  const initialPage = resolveMarketingPreviewPage(params?.view);
  const fixture = getMarketingPreviewFixture(initialState);

  // Core member routes deliberately render the exact signed-in Bullseye
  // presentation components. Only data assembly is replaced with deterministic
  // illustrative fixtures, so private advertising captures cannot drift into a
  // parallel design.
  if (initialPage === "dashboard") {
    return <RealDashboardPreview fixture={fixture} />;
  }
  if (initialPage === "brief") {
    return <RealBriefPreview fixture={fixture} />;
  }
  if (initialPage === "terminal") {
    return <RealTerminalPreview fixture={fixture} />;
  }

  return <MarketingPreviewSurface initialState={initialState} initialPage={initialPage} />;
}
