"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const DISCOVERY_WINDOW_MS = 3_000;
const DISCOVERY_CLICK_COUNT = 5;
const SMILE_DURATION_MS = 1_000;

export function DashboardBrand() {
  const [showSmile, setShowSmile] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const clickTimes = useRef<number[]>([]);
  const smileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const revealSmile = useCallback(() => {
    if (smileTimer.current) clearTimeout(smileTimer.current);
    setShowSmile(true);
    smileTimer.current = setTimeout(() => setShowSmile(false), SMILE_DURATION_MS);
  }, []);

  const closeMessage = useCallback(() => setShowMessage(false), []);

  useEffect(() => {
    if (!showMessage) return;
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMessage();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeMessage, showMessage]);

  useEffect(() => () => {
    if (smileTimer.current) clearTimeout(smileTimer.current);
  }, []);

  const handleActivation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const now = Date.now();
    clickTimes.current = [...clickTimes.current.filter((time) => now - time <= DISCOVERY_WINDOW_MS), now];
    if (clickTimes.current.length >= DISCOVERY_CLICK_COUNT) {
      clickTimes.current = [];
      setShowMessage(true);
    }
  };

  return <>
    <Link
      href="/dashboard"
      className="ftBrand dashboardBrand"
      onClick={handleActivation}
      onPointerEnter={revealSmile}
      aria-label="NASH AI Markets Bullseye dashboard"
    >
      <span className="ftReticle" aria-hidden="true" />
      <span>NASH <b>AI</b> / BULLSEYE</span>
      <span className="dashboardBrandSmile" data-visible={showSmile} aria-hidden="true">😃</span>
    </Link>
    {showMessage ? <div className="bullseyeDiscoveryBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) closeMessage();
    }}>
      <section className="bullseyeDiscovery" role="dialog" aria-modal="true" aria-labelledby="bullseye-discovery-title">
        <span aria-hidden="true">◎</span>
        <h2 id="bullseye-discovery-title">Project BULLSEYE</h2>
        <blockquote>“Every successful project begins with someone refusing to quit.”</blockquote>
        <div aria-hidden="true">😃</div>
        <button ref={closeButton} type="button" onClick={closeMessage}>Close</button>
      </section>
    </div> : null}
  </>;
}
