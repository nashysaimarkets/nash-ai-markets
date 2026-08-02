"use client";

import Link from "next/link";

export default function MarketBriefError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="memberDashboard dashboardError">
      <section className="terminalErrorCard" role="alert">
        <span className="terminalPanelEyebrow">AI MARKET BRIEF</span>
        <h1>The brief could not finish loading.</h1>
        <p>
          No market view has been inferred from the failure. Retry safely, open the Trading Desk, or review
          available verified context on the Dashboard.
        </p>
        <div>
          <button type="button" onClick={reset}>
            Retry brief
          </button>
          <Link href="/terminal">Open Trading Desk</Link>
          <Link href="/dashboard">Show available verified context</Link>
        </div>
        {error.digest ? (
          <details className="memberSupportReference">
            <summary>Support reference</summary>
            <code>{error.digest}</code>
          </details>
        ) : null}
      </section>
    </main>
  );
}
