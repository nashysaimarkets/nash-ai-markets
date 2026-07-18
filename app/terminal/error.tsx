"use client";

import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";

export default function TerminalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="missionControl terminalRouteError">
      <section className="terminalErrorCard" role="alert">
        <BrandLogo audience="member" context="bullseye" />
        <span className="terminalPanelEyebrow">MISSION CONTROL</span>
        <h1>The terminal could not finish loading.</h1>
        <p>No market figures or trading guidance were loaded. Retry when the terminal or provider connection is available.</p>
        <button type="button" onClick={reset}>Retry terminal</button>
        <Link href="/">Return to NASH AI Markets</Link>
      </section>
    </main>
  );
}
