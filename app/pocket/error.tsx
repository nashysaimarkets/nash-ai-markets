"use client";

import { useEffect } from "react";

export default function PocketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const detail = {
      digest: error.digest ?? null,
      name: error.name,
      message: error.message,
    };
    console.error(`[pocket:error] ${JSON.stringify(detail)}`);
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        padding: "max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))",
        background: "radial-gradient(circle at 50% 18%, #15372b 0, #070c0a 38%, #030605 100%)",
        color: "#eef5f1",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <section style={{ width: "min(100%, 430px)", padding: 24, border: "1px solid #315443", borderRadius: 16, background: "#09110eeb" }}>
        <small style={{ color: "#5ceba5", fontWeight: 800, letterSpacing: ".13em" }}>POCKET BULLSEYE · SAFE RECOVERY</small>
        <h1 style={{ margin: "14px 0 10px", fontSize: 28, lineHeight: 1.05 }}>The analysis screen needs to reload.</h1>
        <p style={{ margin: 0, color: "#a7b4ad", fontSize: 15, lineHeight: 1.55 }}>
          Your Apple subscription is unaffected and no trade guidance has been shown. Reload Pocket Bullseye, then choose the chart again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ width: "100%", minHeight: 52, marginTop: 20, border: "1px solid #59eaa3", borderRadius: 10, background: "#173b2c", color: "#eafff4", fontWeight: 850 }}
        >
          RELOAD POCKET BULLSEYE
        </button>
        {error.digest ? <small style={{ display: "block", marginTop: 14, color: "#718078" }}>Reference: {error.digest}</small> : null}
      </section>
    </main>
  );
}
