"use client";

import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";

export default function MarketBriefError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="memberDashboard dashboardError"><section className="terminalErrorCard" role="alert"><BrandLogo audience="member" context="bullseye" /><span className="terminalPanelEyebrow">AI MARKET BRIEF</span><h1>The brief could not finish loading.</h1><p>No market view has been inferred from the failure. Retry safely or continue to the deterministic terminal.</p><button type="button" onClick={reset}>Retry brief</button><Link href="/terminal">Open terminal</Link></section></main>;
}
