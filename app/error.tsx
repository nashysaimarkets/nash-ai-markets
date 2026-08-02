"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Segment-level fallback for every route that does not define its own
 * error.tsx. Without this, an uncaught error renders the unbranded Next.js
 * error screen and the member loses all navigation.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[app:error] ${JSON.stringify({
        digest: error.digest ?? null,
        error: error.name,
        message: error.message,
      })}`,
    );
  }, [error]);

  return (
    <main className="memberDashboard dashboardError">
      <section className="terminalErrorCard" role="alert">
        <span className="terminalPanelEyebrow">NASH AI MARKETS</span>
        <h1>This page could not finish loading.</h1>
        <p>
          Nothing has been inferred from the failure and no market view is shown. Your account and
          subscription are unaffected. Retry, or continue from another verified area.
        </p>
        <div>
          <button type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/dashboard">Open Dashboard</Link>
          <Link href="/terminal">Open Trading Desk</Link>
        </div>
        {error.digest ? <small>Reference: {error.digest}</small> : null}
      </section>
    </main>
  );
}
