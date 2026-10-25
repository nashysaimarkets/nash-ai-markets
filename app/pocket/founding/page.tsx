import { POCKET_PRODUCT } from "../../lib/product-brand";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { campaignAttribution } from "../../lib/marketing-attribution.ts";
import CampaignVisit from "./CampaignVisit.tsx";
import "./pocket-founding.css";

export const metadata: Metadata = {
  title: `${POCKET_PRODUCT.displayName} Founding 650`,
  description: `Try an AI-assisted second opinion on your trading chart, then join the ${POCKET_PRODUCT.displayName} Founding 650 for £4.99 per month.`,
  keywords: ["AI chart analysis", "trading chart analyser", "trading second opinion", "support and resistance scanner", "trading risk check"],
  alternates: { canonical: "/pocket/founding" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${POCKET_PRODUCT.displayName} Founding 650 — AI Chart Analysis for Traders`,
    description: "Get an evidence-led second opinion on your trading chart. Founding membership is £4.99 per month.",
    type: "website",
    url: "/pocket/founding",
    siteName: `${POCKET_PRODUCT.displayName}`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${POCKET_PRODUCT.displayName} Founding 650 — AI Chart Analysis`,
    description: "Get an evidence-led second opinion on your trading chart. Founding membership is £4.99 per month.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07100d" };

const chapters = [
  ["01", "UPLOAD", "Share a clean chart screenshot from your own platform."],
  ["02", "CHALLENGE", `${POCKET_PRODUCT.shortName} reviews structure, levels, contradictions and risk.`],
  ["03", "REVEAL", "Review the source image, report and evidence checks together."],
  ["04", "DECIDE", "Open the written report and wait for the conditions that matter."],
] as const;

export default async function PocketFoundingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const attribution = campaignAttribution({
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_campaign: params.utm_campaign,
  });
  const checkoutState = typeof params.checkout === "string" ? params.checkout : "";
  const outcome = checkoutState === "cancelled" ? "checkout_cancelled"
    : checkoutState === "unavailable" ? "checkout_unavailable" : undefined;
  return <main className="pfLaunch">
    <CampaignVisit attribution={attribution} outcome={outcome} />
    <nav><Link href="/pocket" className="pfBrand"><i />{POCKET_PRODUCT.displayName}</Link><a href="#founding" data-pb-growth-click="founding_offer_clicked">FOUNDING 650</a></nav>
    <section className="pfHero">
      <div className="pfHeroCopy"><span>AI CHART ANALYSIS · TRADING SECOND OPINION</span><h1>Before money meets market,<em>review the evidence.</em></h1><p>Upload your chart for an evidence-led second opinion on levels, invalidation and reasons to wait.</p><div><a href="https://apps.apple.com/gb/app/pocket-bullseye-ai-charts/id6806004581" data-pb-growth-click="app_open_clicked">GET THE IPHONE APP</a><Link href="/pocket" data-pb-growth-click="app_open_clicked">OPEN THE WEB APP</Link></div><small>Subscription required for analysis · Educational decision support · No trade execution</small></div>
      <div className="pfPhone" aria-label={`${POCKET_PRODUCT.shortName} result preview`}><header><i /> {POCKET_PRODUCT.shortName} SAMPLE</header><div className="pfTarget"><i/><i/><i/><b>{POCKET_PRODUCT.shortName}</b></div><strong>YOUR EVIDENCE BALANCE</strong><section><span>BULL<strong>58%</strong></span><em>VS</em><span>BEAR<strong>42%</strong></span></section><p>SYNTHETIC SAMPLE · UNVERIFIED · NOT PROBABILITY</p></div>
    </section>
    <section className="pfSequence"><header><span>FROM CHART TO DECISION</span><h2>Your evidence, explained.</h2><p>Review what the screenshot supports, what remains uncertain and where the plan becomes invalid.</p></header><div>{chapters.map(([n,title,copy])=><article key={n}><b>{n}</b><strong>{title}</strong><p>{copy}</p></article>)}</div></section>
    <section id="founding" className="pfOffer"><div><span>FOUNDING 650 OFFER</span><h2>£4.99<small>/month</small></h2><p>Your {POCKET_PRODUCT.name} price stays at £4.99 per month for as long as that founding subscription remains continuously active.</p><ul><li>Exclusive access to the building of the main Bullseye project</li><li>Founder feedback and feature-influence channel</li><li>Intended £12/month main-project founding price when it launches, subject to final terms</li></ul></div><aside><strong>JOIN THE FOUNDING 650</strong><p>Continue to Stripe’s secure checkout to start your £4.99 monthly subscription. You can cancel at any time.</p><form className="waitlistForm" action="/api/stripe/checkout" method="post" data-pb-growth-submit="checkout_started"><input type="hidden" name="utm_source" value={attribution.source} /><input type="hidden" name="utm_medium" value={attribution.medium} /><input type="hidden" name="utm_campaign" value={attribution.campaign} /><div><button type="submit" name="offering" value="pocket_founding_month">CONTINUE TO SECURE CHECKOUT <span aria-hidden="true">↗</span></button></div></form><small>Places are assigned only after verified successful checkout. Cancelling ends the continuous-price guarantee.</small></aside></section>
    <section className="pfTruth"><article><b aria-hidden="true">01</b><strong>PRIVATE BY DESIGN</strong><p>Remove names, balances and account details before upload.</p></article><article><b aria-hidden="true">02</b><strong>EVIDENCE, NOT ODDS</strong><p>Percentages describe visible evidence balance—not market probability.</p></article><article><b aria-hidden="true">03</b><strong>PATIENCE COUNTS</strong><p>WAIT and STAND ASIDE are valid, useful outcomes.</p></article></section>
    <footer><p>Speculative educational analysis only. {POCKET_PRODUCT.name} does not provide personalised financial advice, execute trades or guarantee outcomes.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/risk-disclaimer">Risk warning</Link></div></footer>
  </main>;
}
