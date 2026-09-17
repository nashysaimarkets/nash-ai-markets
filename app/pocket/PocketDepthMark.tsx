"use client";

import OrbitalInstrument from "./OrbitalInstrument";
import type { PointerEvent } from "react";

/** Decorative orbital sculpture with a small pointer response. */
export default function PocketDepthMark({ scanning = false }: { scanning?: boolean }) {
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.closest<HTMLElement>(".psApp")?.dataset.spatialMotion === "off" || event.pointerType !== "mouse" || scanning || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    if (!width || !height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - left) / width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - top) / height * 2 - 1));
    event.currentTarget.style.setProperty("--depth-x", `${x * 5}deg`);
    event.currentTarget.style.setProperty("--depth-y", `${-y * 5}deg`);
  };
  const reset = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--depth-x");
    event.currentTarget.style.removeProperty("--depth-y");
  };

  return <div className="psDepthScene" aria-hidden="true" data-scanning={scanning} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
    <div className="psDepthObject">
      <OrbitalInstrument size="hero" />
    </div>
    <div className="psDepthCaption"><i /><span>{scanning ? "READING YOUR CHART" : "EVIDENCE. THEN ACTION."}</span></div>
  </div>;
}

export function PocketGlyph({ kind = "target" }: { kind?: "target" | "up" | "down" | "shield" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "target" ? <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></> : null}
    {kind === "up" ? <><path d="m4 17 6-6 4 3 6-8M14 6h6v6" /></> : null}
    {kind === "down" ? <><path d="m4 7 6 6 4-3 6 8M14 18h6v-6" /></> : null}
    {kind === "shield" ? <><path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z" /><path d="m8 12 3 3 5-6" /></> : null}
  </svg>;
}
