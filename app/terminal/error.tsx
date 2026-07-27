"use client";

import Link from "next/link";

/** Inline colours beat global body text (#f7f7f2) on Next’s white error canvas. */
const shellStyle = {
  minHeight: "100vh",
  margin: 0,
  padding: 30,
  display: "grid",
  placeItems: "center",
  background: "#05070a",
  color: "#eef2f5",
  fontFamily: "var(--font-geist-sans), Arial, sans-serif",
} as const;

const cardStyle = {
  width: "min(600px, 100%)",
  padding: 30,
  border: "1px solid #3a554c",
  borderRadius: 12,
  background: "#0a0d12",
  color: "#eef2f5",
} as const;

export default function TerminalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="missionControl terminalRouteError" style={shellStyle}>
      <section className="terminalErrorCard" role="alert" style={cardStyle}>
        <span className="terminalPanelEyebrow" style={{ color: "#62e6b1" }}>MISSION CONTROL</span>
        <h1 style={{ color: "#f4f3ec", margin: "12px 0" }}>The terminal could not finish loading.</h1>
        <p style={{ color: "#9aa7a0", lineHeight: 1.6 }}>
          No market figures or trading guidance were loaded. Retry when the terminal or provider connection is available.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            margin: "12px 10px 0 0",
            minHeight: 44,
            padding: "10px 14px",
            border: "1px solid #2f4038",
            borderRadius: 8,
            background: "#12201a",
            color: "#eef2f5",
            cursor: "pointer",
          }}
        >
          Retry terminal
        </button>
        <Link href="/" style={{ color: "#62e6b1" }}>Return to NASH AI Markets</Link>
      </section>
    </main>
  );
}
