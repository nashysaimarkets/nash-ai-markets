"use client";

import { useEffect, useState } from "react";
import { formatEventCountdown } from "../lib/daily-dashboard.ts";

export function EventCountdown({ startsAt, initialNow }: { startsAt: string; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <strong>{formatEventCountdown(startsAt, now) ?? "Event window reached"}</strong>;
}
