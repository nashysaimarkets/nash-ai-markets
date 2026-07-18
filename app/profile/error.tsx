"use client";

import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="memberDashboard dashboardError"><section className="terminalErrorCard" role="alert"><BrandLogo audience="member" context="bullseye" /><span className="terminalPanelEyebrow">MEMBER PROFILE</span><h1>Your profile could not finish loading.</h1><p>No account, billing, or provider error details have been exposed. Retry safely or return to your dashboard.</p><button type="button" onClick={reset}>Retry profile</button><Link href="/dashboard">Return to dashboard</Link></section></main>;
}
