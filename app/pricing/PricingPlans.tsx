"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Founding100Availability } from "../lib/server/founding-100.ts";
import { founding100AvailabilityLabel } from "../lib/server/founding-100.ts";

const features = [
  ["Market overview", "Included", "Included", "Included"],
  ["Official macro and event context", "Included", "Included", "Included"],
  ["Preparation checklist and mission card", "Included", "Included", "Included"],
  ["Weekly Pro preview", "Included", "—", "—"],
  ["Verified intraday decision layer", "Preview", "When licensed feed is available", "When licensed feed is available"],
  ["Private process journal", "Locked", "Included", "Included"],
  ["Structured trade planner", "Locked", "Daily preview", "Included"],
  ["Launch diagnostics", "Locked", "Daily preview", "Included"],
] as const;

export function PricingPlans({ availability }: { availability: Founding100Availability }) {
  const [annual, setAnnual] = useState(false);
  const pro = founding100AvailabilityLabel(availability.proRemaining);
  return <>
    <p className="commercialPlanGuide"><strong>Not sure where to start?</strong> Free includes official macro context and preparation tools. Pro adds the complete daily planning routine, and Elite adds advanced planning and diagnostics. Intraday intelligence appears only when a verified licensed feed is available.</p>
    <div className="commercialToggle" role="group" aria-label="Billing interval">
      <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
      <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual</button>
    </div>
    <section className="commercialPlans" aria-label="Membership plans">
      <article className="commercialFree"><div className="commercialPlanIdentity"><Image src="/brand/logo-mark.svg" width={48} height={48} alt="" /><span>FREE</span></div><h2>£0</h2><small className="commercialPlanFit">For exploring the Bullseye method</small><p>Core market overview with a measured path into premium intelligence.</p><Link href="/login">Start free</Link></article>
      <article className="commercialPopular"><b>MOST POPULAR</b><div className="commercialPlanIdentity"><Image src="/brand/logo-mark.svg" width={48} height={48} alt="" /><span>PRO</span></div><h2>{annual ? "£149/year" : pro.full ? "£14.99/month" : "£12/month"}</h2>{!annual && !pro.full ? <small className="commercialLaunchPrice">FOUNDING LAUNCH PRICE · THEN £14.99/MONTH</small> : null}<small className="commercialPlanFit">For a complete daily pre-market routine</small><p>Official macro context, event-risk preparation, process tools and verified market intelligence whenever entitled data is available.</p>{annual ? <div className="commercialFounding isFull"><strong>STANDARD ANNUAL PRO</strong><span>£149 annual billing</span><small>Annual Pro is not part of the monthly Founding 100 price-lock programme.</small></div> : <div className={`commercialFounding${pro.full ? " isFull" : ""}`}><strong>FOUNDING 100 PRO</strong><span>{pro.label}</span><small>{!pro.full ? "Reserve the £12/month launch offer. Checkout opens after final verification." : pro.detail}</small></div>}{!annual && !pro.full ? <Link className="commercialLaunchCta" href="/waitlist?plan=founding-pro">Reserve Founding Pro</Link> : <form action="/api/stripe/checkout" method="post"><input type="hidden" name="offering" value={annual ? "pro_year" : "pro_month"} /><button type="submit">Start Pro Membership</button></form>}</article>
      <article className="commercialElite">
        <div className="commercialPlanBadges">
          <Image src="/brand/badge-elite.svg" width={220} height={56} alt="Elite membership" />
        </div>
        <h2>{annual ? "£299/year" : "£29.99/month"}</h2>
        <small className="commercialPlanFit">For advanced planning and diagnostics</small>
        <p>Full planning and diagnostic access, plus verified intraday intelligence whenever entitled licensed data is available.</p>
        <form action="/api/stripe/checkout" method="post"><input type="hidden" name="offering" value={annual ? "elite_year" : "elite_month"} /><button type="submit">Unlock Elite</button></form>
      </article>
    </section>
    <div
      className="comparisonScroll"
      role="region"
      aria-label="Feature comparison table"
      tabIndex={0}
    >
      <table className="commercialComparison">
        <caption>Feature comparison</caption>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Free</th>
            <th>Pro</th>
            <th>Elite</th>
          </tr>
        </thead>
        <tbody>
          {features.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={`${row[0]}-${cell}`}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>;
}
