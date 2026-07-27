import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { loadFounding100Availability } from "../lib/server/founding-100.ts";
import { PricingPlans } from "./PricingPlans.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "NASH Membership",
  description: "Choose access to the focused NASH AI Markets daily decision brief, evidence record and review workflow.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "NASH AI Markets Membership",
    description: "Access a focused daily decision brief, its evidence and your review history.",
    url: "/pricing",
  },
};

const faqs = [
  ["Is checkout secure?", "Yes. Subscription checkout is created server-side and completed on Stripe. Card details are not stored by NASH AI Markets."],
  ["What does the annual plan include?", "Annual Pro and Elite provide the same tier access as monthly billing at the published annual price."],
  ["How does Founding 100 work?", "The first 100 verified successful subscribers in each paid tier receive a permanent Founding badge and retain their original subscription price while that subscription remains continuously active."],
  ["What happens if a Founding subscription ends?", "The badge remains in programme history, but the lifetime price lock is permanently lost. A later subscription uses the then-current standard price."],
  ["Can I change plan?", "Use the Stripe customer portal to review available upgrades, downgrades or cancellation. Any price and effective date are shown by Stripe before confirmation."],
  ["Is this financial advice?", "No. NASH AI Markets provides educational market commentary and decision support, not personalised financial advice or guaranteed outcomes."],
] as const;

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [availability, query] = await Promise.all([loadFounding100Availability(), searchParams]);
  return <main className="commercialPage">
    <a className="commercialSkip" href="#pricing-content">Skip to pricing</a>
    <header className="commercialNav"><BrandLogo /><Link href="/login">Member login</Link></header>
    <div id="pricing-content">
      <section className="commercialHero"><span>MEMBERSHIP · ONE FOCUSED DAILY WORKFLOW</span><h1>Prepare with clarity.<br />Review with <em>evidence.</em></h1><p>Start with the recommended NASH Membership for the complete Today → Evidence → Review journey. Existing Free and Elite access remain available, with secure Stripe billing and no guaranteed outcomes.</p><div className="commercialHeroTrust" aria-label="Membership principles"><span>One daily brief</span><span>Preserved evidence</span><span>Private review</span><span>Cancel through Stripe</span></div>{query.checkout === "unavailable" ? <div className="commercialError" role="alert">Secure checkout is temporarily unavailable. No payment was taken. Please retry later.</div> : null}</section>
      <PricingPlans availability={availability} />
    </div>
    <section className="commercialAssurance" aria-labelledby="assurance-title">
      <div><span>BUY WITH CLARITY</span><h2 id="assurance-title">A membership built on transparent boundaries.</h2></div>
      <ul><li><strong>Secure checkout</strong><span>Payment details stay with Stripe.</span></li><li><strong>Visible data quality</strong><span>Freshness and provider status remain in view.</span></li><li><strong>No outcome promises</strong><span>Educational scenarios, never guaranteed trades.</span></li></ul>
    </section>
    <section className="commercialFaq"><span>QUESTIONS, ANSWERED</span><h2>Frequently asked questions</h2><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <p className="commercialRisk"><strong>Risk notice:</strong> Trading futures and options can result in substantial losses. Membership provides educational information only.</p>
    <footer className="commercialFooter"><BrandLogo /><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/risk-disclaimer">Risk disclaimer</Link></div></footer>
  </main>;
}
