"use client";

import { useEffect, useRef } from "react";

export type InstrumentKind = "target" | "liquidity" | "patterns" | "macro" | "risk" | "levels";

/** Decorative instrument geometry; never represents a price, score or scan progress. */
export default function OrbitalInstrument({ kind = "target", size = "small" }: { kind?: InstrumentKind; size?: "small" | "large" | "hero" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.visible = String(entry.isIntersecting);
    }, { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} className="psOrbital" data-kind={kind} data-size={size} aria-hidden="true">
    <span className="psOrbitAura" />
    <span className="psOrbitWorld">
      <span className="psOrbitRing psOrbitRingOuter" />
      <span className="psOrbitRing psOrbitRingMiddle" />
      <span className="psOrbitRing psOrbitRingInner" />
      <span className="psOrbitTicks" />
      <span className="psOrbitCore">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {kind === "target" ? <><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none"/><path d="M24 4v8m0 24v8M4 24h8m24 0h8"/></> : null}
          {kind === "liquidity" ? <><path d="m24 7 13 5v11c0 9-8 15-13 18-5-3-13-9-13-18V12Z"/><path d="M16 24h5l3-8 4 16 3-8h4"/></> : null}
          {kind === "patterns" ? <><path d="m7 34 9-17 9 12 10-20 6 7M7 39h34"/><circle cx="16" cy="17" r="2"/><circle cx="25" cy="29" r="2"/><circle cx="35" cy="9" r="2"/></> : null}
          {kind === "macro" ? <><circle cx="24" cy="24" r="16"/><ellipse cx="24" cy="24" rx="7" ry="16"/><path d="M9 18h30M9 30h30M8 24h32"/></> : null}
          {kind === "risk" ? <><path d="M24 6 43 39H5Z"/><path d="M24 18v10m0 5v1"/></> : null}
          {kind === "levels" ? <><path d="M8 12h32M8 24h32M8 36h32"/><circle cx="18" cy="12" r="3"/><circle cx="32" cy="24" r="3"/><circle cx="22" cy="36" r="3"/></> : null}
        </svg>
      </span>
      <span className="psOrbitSatellite psOrbitSatelliteOne" /><span className="psOrbitSatellite psOrbitSatelliteTwo" />
    </span>
    <span className="psOrbitFloor" />
  </span>;
}
