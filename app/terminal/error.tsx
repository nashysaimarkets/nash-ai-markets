"use client";

export default function TerminalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="missionControl terminalRouteError">
      <section className="terminalErrorCard" role="alert">
        <span className="terminalPanelEyebrow">MISSION CONTROL</span>
        <h1>The terminal could not finish loading.</h1>
        <p>No market figures or trading guidance were loaded. Retry when the terminal or provider connection is available.</p>
        <button type="button" onClick={reset}>Retry terminal</button>
        <a href="/">Return to NASH AI Markets</a>
      </section>
    </main>
  );
}
