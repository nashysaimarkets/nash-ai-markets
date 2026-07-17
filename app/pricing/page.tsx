import type { Metadata } from "next";
import Link from "next/link";
import { loadFounding100Availability } from "../lib/server/founding-100.ts";
import { PricingPlans } from "./PricingPlans.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare Free, Pro and Elite NASH AI Markets memberships.",
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
    <header className="commercialNav"><Link href="/">NASH <b>AI</b> MARKETS</Link><Link href="/login">Member login</Link></header>
    <section className="commercialHero"><span>MEMBERSHIP</span><h1>Choose the intelligence<br />that fits your process.</h1><p>Transparent monthly and annual access. No invented scarcity, no guaranteed outcomes, and secure Stripe billing.</p>{query.checkout === "unavailable" ? <div className="commercialError" role="alert">Secure checkout is temporarily unavailable. No payment was taken. Please retry later.</div> : null}</section>
    <PricingPlans availability={availability} />
    <section className="commercialFaq"><span>QUESTIONS, ANSWERED</span><h2>Frequently asked questions</h2><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <p className="commercialRisk"><strong>Risk notice:</strong> Trading futures and options can result in substantial losses. Membership provides educational information only.</p>
  </main>;
}
