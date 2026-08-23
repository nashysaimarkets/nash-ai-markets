"use client";

import { useEffect, useState } from "react";

/**
 * Tiny presentation-only easter egg for the signed-in Bullseye experience.
 * Intentionally isolated from auth, market data, billing and decision logic.
 */
export function SmileyEasterEgg() {
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (!found) return;

    const timer = window.setTimeout(() => setFound(false), 2600);
    return () => window.clearTimeout(timer);
  }, [found]);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        left: 10,
        bottom: 8,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        aria-label="Hidden Bullseye smiley"
        title="😁"
        onClick={() => setFound(true)}
        style={{
          pointerEvents: "auto",
          appearance: "none",
          border: 0,
          background: "transparent",
          padding: 2,
          margin: 0,
          fontSize: 12,
          lineHeight: 1,
          opacity: found ? 0.92 : 0.16,
          cursor: "pointer",
          transition: "opacity 160ms ease, transform 160ms ease",
          transform: found ? "scale(1.18)" : "scale(1)",
        }}
      >
        😁
      </button>
      {found ? (
        <span
          style={{
            border: "1px solid rgba(78, 255, 199, 0.34)",
            borderRadius: 999,
            background: "rgba(2, 14, 14, 0.92)",
            color: "rgba(222, 255, 246, 0.92)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.32)",
            padding: "6px 10px",
            fontSize: 11,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          🎯 You found Bullseye!
        </span>
      ) : null}
    </div>
  );
}
