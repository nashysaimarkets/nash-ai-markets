"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Preferences reads no market data, so a failure here must not surface the
 * generic market-flavoured fallback. Scoping the boundary to this route keeps
 * the message truthful and keeps the rest of the member area reachable.
 */
export default function PreferencesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[preferences:error] ${JSON.stringify({
        digest: error.digest ?? null,
        error: error.name,
        message: error.message,
      })}`,
    );
  }, [error]);

  return (
    <main className="memberDashboard dashboardError">
      <section className="terminalErrorCard" role="alert">
        <span className="terminalPanelEyebrow">PREFERENCES</span>
        <h1>Your preferences could not be displayed.</h1>
        <p>
          This page does not read market data, so no market view, verified snapshot or subscription
          detail is affected. Your saved layout is stored in this browser and has not been changed.
          Try again, or continue from another area.
        </p>
        <div>
          <button type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/dashboard">Return to Dashboard</Link>
          <Link href="/onboarding">Open account workspace</Link>
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
