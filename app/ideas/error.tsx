"use client";

import Link from "next/link";

export default function IdeasError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="memberDashboard">
      <div className="ideasPage">
        <section className="ideasUnavailable" role="alert">
          <span>MEMBER IDEAS</span>
          <h1>Ideas could not be shown.</h1>
          <p>
            Something went wrong while loading the Ideas Hub. No idea content has been invented.
            Retry safely or continue with verified market preparation.
          </p>
          <div className="ideasUnavailableActions">
            <button type="button" onClick={reset}>
              Retry Ideas
            </button>
            <Link href="/brief">Open Morning Brief</Link>
            <Link href="/terminal">Open Trading Desk</Link>
            <Link href="/dashboard">Open Dashboard</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
