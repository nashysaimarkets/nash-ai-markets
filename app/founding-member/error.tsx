"use client";

import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";

export default function FoundingMemberError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="memberDashboard dashboardError"><section className="terminalErrorCard" role="alert"><BrandLogo audience="member" context="bullseye" /><span className="terminalPanelEyebrow">FOUNDING MEMBER ONBOARDING</span><h1>Onboarding could not finish loading.</h1><p>No application, membership, or database details have been inferred from the failure.</p><button type="button" onClick={reset}>Retry onboarding</button><Link href="/dashboard">Return to dashboard</Link></section></main>;
}
