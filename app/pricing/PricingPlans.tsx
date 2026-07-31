"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Founding100Availability } from "../lib/server/founding-100.ts";
import { founding100AvailabilityLabel } from "../lib/server/founding-100.ts";

const features = [
  ["Market overview", "Included", "Included", "Included"],
  ["Weekly Pro preview", "Included", "—", "—"],
  ["Daily intelligence and decision engine", "Preview", "Included", "Included"],
  ["Structured trade planner", "Locked", "Daily preview", "Included"],
  ["Launch diagnostics", "Locked", "Daily preview", "Included"],
] as const;

export function PricingPlans({ availability }: { availability: Founding100Availability }) {
  const [annual, setAnnual] = useState(false);
  const pro = founding100AvailabilityLabel(availability.proRemaining);
  const elite = founding100AvailabilityLabel(availability.eliteRemaining);
  return <>
    <p className="commercialPlanGuide"><strong>Not sure where to start?</strong> Free explores the workflow, Pro unlocks the complete daily intelligence layer, and Elite adds the full planning and diagnostics workspace.</p>
    <div className="commercialToggle" role="group" aria-label="Billing interval">
      <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
      <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual</button>
    </div>
    <section className="commercialPlans" aria-label="Membership plans">
      <article className="commercialFree"><div className="commercialPlanIdentity"><Image src="/brand/logo-mark.svg" width={48} height={48} alt="" /><span>FREE</span></div><h2>£0</h2><small className="commercialPlanFit">For exploring the Bullseye method</small><p>Core market overview with a measured path into premium intelligence.</p><Link href="/login">Start free</Link></article>
      <article className="commercialPopular"><b>MOST POPULAR</b><div className="commercialPlanIdentity"><Image src="/brand/logo-mark.svg" width={48} height={48} alt="" /><span>PRO</span></div><h2>{annual ? "£149/year" : "£14.99/month"}</h2><small className="commercialPlanFit">For a complete daily pre-market routine</small><p>Daily intelligence, decision support and a daily Elite preview.</p><div className={`commercialFounding${pro.full ? " isFull" : ""}`}><strong>FOUNDING 100 PRO</strong><span>{pro.label}</span><small>{pro.detail}</small></div><form action="/api/stripe/checkout" method="post"><input type="hidden" name="offering" value={annual ? "pro_year" : "pro_month"} /><button type="submit">Start Pro Membership</button></form></article>
      <article className="commercialElite">
        <div className="commercialPlanBadges">
          <Image src="/brand/badge-elite.svg" width={220} height={56} alt="Elite membership" />
          <Image src="/brand/badge-founding-100.svg" width={270} height={56} alt="Founding 100 member programme" />
        </div>
        <h2>{annual ? "£299/year" : "£29.99/month"}</h2>
        <small className="commercialPlanFit">For advanced planning and diagnostics</small>
        <p>Full intelligence, planning and diagnostic access for the complete workflow.</p>
        <div className={`commercialFounding${elite.full ? " isFull" : ""}`}><strong>FOUNDING 100 ELITE</strong><span>{elite.label}</span><small>{elite.detail}</small></div>
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
