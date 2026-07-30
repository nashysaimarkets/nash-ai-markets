"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="memberDashboard dashboardError eliteDashboardError">
      <section className="terminalErrorCard" role="alert">
        <i aria-hidden="true">!</i>
        <span className="terminalPanelEyebrow">BULLSEYE / SAFE STATE</span>
        <h1>The command view is temporarily unavailable.</h1>
        <p>
          No market mission, event countdown, or performance result has been inferred. Retry safely or continue
          to the Trading Desk.
        </p>
        <div>
          <button type="button" onClick={reset}>
            Retry dashboard
          </button>
          <Link href="/terminal">Open Trading Desk</Link>
          <Link href="/brief">Open Morning Brief</Link>
        </div>
        {error.digest ? <small>Reference: {error.digest}</small> : <small>Fail-closed controls remain active.</small>}
      </section>
    </main>
  );
}
