"use client";

import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo.tsx";

export default function Founding100AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="foundingAdminPage dashboardError"><section className="terminalErrorCard" role="alert"><BrandLogo audience="member" context="bullseye" /><span className="terminalPanelEyebrow">FOUNDING 100 OPERATIONS</span><h1>The Founding report could not load.</h1><p>No place count, member identity, subscription status, or database detail has been inferred.</p><button type="button" onClick={reset}>Retry report</button><Link href="/dashboard">Return to dashboard</Link></section></main>;
}
