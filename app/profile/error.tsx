"use client";

import Link from "next/link";

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="memberDashboard dashboardError"><section className="terminalErrorCard" role="alert"><span className="terminalPanelEyebrow">MEMBER PROFILE</span><h1>Your profile could not finish loading.</h1><p>No account, billing, or provider error details have been exposed. Retry safely or return to your dashboard.</p><button type="button" onClick={reset}>Retry profile</button><Link href="/dashboard">Return to dashboard</Link></section></main>;
}
