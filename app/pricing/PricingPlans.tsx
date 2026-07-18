"use client";

import Image from "next/image";
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
    <div className="commercialToggle" role="group" aria-label="Billing interval">
      <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
      <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual</button>
    </div>
    <section className="commercialPlans" aria-label="Membership plans">
      <article><span>FREE</span><h2>£0</h2><p>Core market overview with a measured path into premium intelligence.</p><a href="/login">Start free</a></article>
      <article className="commercialPopular"><b>MOST POPULAR</b><span>PRO</span><h2>{annual ? "£149/year" : "£14.99/month"}</h2><p>Daily intelligence, decision support and a daily Elite preview.</p><div className={`commercialFounding${pro.full ? " isFull" : ""}`}><strong>FOUNDING 100 PRO</strong><span>{pro.label}</span><small>{pro.detail}</small></div><form action="/api/stripe/checkout" method="post"><input type="hidden" name="offering" value={annual ? "pro_year" : "pro_month"} /><button type="submit">Choose Pro securely</button></form></article>
      <article className="commercialElite">
        <div className="commercialPlanBadges">
          <Image src="/brand/elite-member-badge.svg" width={300} height={72} alt="Elite membership" />
          <Image src="/brand/founding-100-badge.svg" width={330} height={72} alt="Founding 100 member programme" />
        </div>
        <h2>{annual ? "£299/year" : "£29.99/month"}</h2>
        <p>Full intelligence, planning and diagnostic access for the complete workflow.</p>
        <div className={`commercialFounding${elite.full ? " isFull" : ""}`}><strong>FOUNDING 100 ELITE</strong><span>{elite.label}</span><small>{elite.detail}</small></div>
        <form action="/api/stripe/checkout" method="post"><input type="hidden" name="offering" value={annual ? "elite_year" : "elite_month"} /><button type="submit">Choose Elite securely</button></form>
      </article>
    </section>
    <div className="comparisonScroll"><table className="commercialComparison"><caption>Feature comparison</caption><thead><tr><th>Feature</th><th>Free</th><th>Pro</th><th>Elite</th></tr></thead><tbody>{features.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th key={cell} scope="row">{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
  </>;
}
