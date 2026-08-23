"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the
 * layout, so it must render its own document shell and cannot depend on the
 * app stylesheet having loaded — styles are inlined deliberately.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[app:global-error] ${JSON.stringify({
        digest: error.digest ?? null,
        error: error.name,
        message: error.message,
      })}`,
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#070b0e",
          color: "#e6edf3",
          fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        }}
      >
        <main
          role="alert"
          style={{
            width: "min(560px, 100%)",
            padding: "32px",
            border: "1px solid #27343d",
            borderRadius: "8px",
            background: "#0b1116",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#38f28e",
              font: "700 10px ui-monospace, monospace",
              letterSpacing: "0.14em",
            }}
          >
            NASH AI MARKETS
          </p>
          <h1 style={{ margin: "14px 0 10px", fontSize: "26px", letterSpacing: "-0.02em" }}>
            The application could not start.
          </h1>
          <p style={{ margin: 0, color: "#8f9c96", fontSize: "14px", lineHeight: 1.6 }}>
            No market data has been shown or inferred. Your account and subscription are unaffected.
            Retry, or return to the home page.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "22px" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "44px",
                padding: "10px 16px",
                border: "1px solid #38f28e",
                borderRadius: "6px",
                background: "#38f28e",
                color: "#06100d",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A hard navigation is deliberate: the root layout failed, so the
                client router cannot be trusted to render a new route. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 16px",
                border: "1px solid #27343d",
                borderRadius: "6px",
                color: "#e6edf3",
                textDecoration: "none",
              }}
            >
              Return home
            </a>
          </div>
          {error.digest ? (
            <p style={{ marginTop: "20px", color: "#68737f", font: "11px ui-monospace, monospace" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
