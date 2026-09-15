"use client";

import { useEffect, useState, type ReactNode } from "react";
import { sampleDestination, setUsageDisabled, trackGrowth, usageDisabled } from "./growth-client";

export function IntroductionVisit() {
  useEffect(() => { trackGrowth("introduction_viewed", { once: "introduction" }); }, []);
  return null;
}

export function AppStoreLink({ children, className }: { children: ReactNode; className?: string }) {
  return <a className={className} href="https://apps.apple.com/app/id6806004581" onClick={() => trackGrowth("app_store_clicked")}>{children}</a>;
}

export function SampleLink({ className }: { className?: string }) {
  const [href, setHref] = useState("/pocket?demo=1");
  useEffect(() => { setHref(sampleDestination()); }, []);
  return <a className={className} href={href}>Explore a sample analysis</a>;
}

export function UsageControl() {
  const [disabled, setDisabled] = useState(false);
  useEffect(() => { setDisabled(usageDisabled()); }, []);
  return <div className="psUsageControl"><span>Anonymous activity counts help improve the app. No chart or personal details. </span><button type="button" aria-pressed={!disabled} onClick={() => { setUsageDisabled(!disabled); setDisabled(usageDisabled()); }}>{disabled ? "Usage counts off · turn on" : "Turn usage counts off"}</button> <a href="/privacy#usage-counts">Details</a></div>;
}
