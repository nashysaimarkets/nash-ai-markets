"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketDataStatus } from "../../lib/market-data";

const LIVE_REFRESH_SECONDS = 15;
const RECOVERY_REFRESH_SECONDS = 60;

function formatClock(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

function formatAge(asOf: string, now: number) {
  const timestamp = Date.parse(asOf);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Unavailable";
  const totalSeconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (totalSeconds < 60) return `${totalSeconds}s old`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s old`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
}

export function MarketFreshnessClock({
  asOf,
  status,
  sessionLabel,
  initialNow,
}: {
  asOf: string;
  status: MarketDataStatus;
  sessionLabel: string;
  initialNow: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.parse(initialNow));
  const [refreshing, startTransition] = useTransition();
  const refreshSeconds = status === "LIVE" || status === "DELAYED"
    ? LIVE_REFRESH_SECONDS
    : RECOVERY_REFRESH_SECONDS;
  const [nextRefresh, setNextRefresh] = useState(refreshSeconds);
  const nextRefreshAt = useRef(Date.parse(initialNow) + refreshSeconds * 1_000);

  useEffect(() => {
    setNextRefresh(refreshSeconds);
    nextRefreshAt.current = Date.now() + refreshSeconds * 1_000;
  }, [refreshSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (document.visibilityState !== "visible") return;
      if (current >= nextRefreshAt.current) {
        nextRefreshAt.current = current + refreshSeconds * 1_000;
        startTransition(() => router.refresh());
      }
      setNextRefresh(Math.max(0, Math.ceil((nextRefreshAt.current - current) / 1_000)));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [refreshSeconds, router]);

  const current = useMemo(() => new Date(now), [now]);
  const age = formatAge(asOf, now);

  return (
    <>
      <div>
        <dt>Session</dt>
        <dd>{sessionLabel}</dd>
      </div>
      <div>
        <dt>Market time (ET)</dt>
        <dd>{formatClock(current, "America/New_York")}</dd>
      </div>
      <div>
        <dt>UK time</dt>
        <dd>{formatClock(current, "Europe/London")}</dd>
      </div>
      <div>
        <dt>Verified observation</dt>
        <dd>{age}</dd>
        <small>{refreshing ? "Refreshing verified feeds…" : `Next check in ${nextRefresh}s`}</small>
      </div>
    </>
  );
}

export function MarketAge({ asOf, initialNow }: { asOf: string; initialNow: string }) {
  const [now, setNow] = useState(() => Date.parse(initialNow));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{formatAge(asOf, now)}</>;
}
