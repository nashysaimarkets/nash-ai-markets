"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="memberDashboard dashboardError"><section className="terminalErrorCard" role="alert"><span className="terminalPanelEyebrow">MEMBER DASHBOARD</span><h1>Your daily dashboard could not finish loading.</h1><p>No market mission, event countdown, or performance result has been inferred. Retry safely or continue to the terminal.</p><button type="button" onClick={reset}>Retry dashboard</button><Link href="/terminal">Open terminal</Link></section></main>;
}
