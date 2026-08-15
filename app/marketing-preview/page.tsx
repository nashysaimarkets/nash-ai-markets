import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPreviewSurface } from "./components/MarketingPreviewSurface.tsx";
import {
  MARKETING_PREVIEW_STATES,
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

  return <MarketingPreviewSurface initialState={initialState} initialPage={initialPage} />;
}
