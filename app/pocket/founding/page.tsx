import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./pocket-founding.css";

export const metadata: Metadata = {
  title: "Pocket Bullseye Founding 650",
  description: "Join the first 650 Pocket Bullseye founding members at £4.99 per month while continuously subscribed.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07100d" };

const chapters = [
  ["01", "UPLOAD", "Share a clean chart screenshot from your own platform."],
  ["02", "CHALLENGE", "Bullseye audits structure, levels, contradictions and risk."],
  ["03", "REVEAL", "Watch the cinematic result and personal bull/bear evidence balance."],
  ["04", "DECIDE", "Open the written report and wait for the conditions that matter."],
] as const;

export default function PocketFoundingPage() {
  return <main className="pfLaunch">
    <nav><Link href="/pocket" className="pfBrand"><i />POCKET BULLSEYE</Link><a href="#founding">FOUNDING 650</a></nav>
    <section className="pfHero">
      <div className="pfHeroCopy"><span>PRIVATE CHART SECOND OPINION</span><h1>Before money meets market,<em>hit Bullseye.</em></h1><p>Upload one chart. Get an evidence-led challenge, a cinematic result story and a written plan for what deserves patience next.</p><div><a href="#founding">JOIN THE FIRST 650</a><Link href="/pocket">OPEN POCKET BULLSEYE</Link></div><small>Educational decision support · Not a signal service · No broker connection</small></div>
      <div className="pfPhone" aria-label="Pocket Bullseye result preview"><header><i /> BULLSEYE RESULT</header><div className="pfTarget"><i/><i/><i/><b>🎯</b></div><strong>YOUR EVIDENCE BALANCE</strong><section><span>🐂 BULL<strong>58%</strong></span><em>VS</em><span>🐻 BEAR<strong>42%</strong></span></section><p>EVIDENCE BALANCE · NOT PROBABILITY</p></div>
    </section>
    <section className="pfSequence"><header><span>THE 90-SECOND RESULT STORY</span><h2>Not another wall of indicators.</h2><p>Bullseye turns the customer’s own screenshot into a paced, understandable decision story.</p></header><div>{chapters.map(([n,title,copy])=><article key={n}><b>{n}</b><strong>{title}</strong><p>{copy}</p></article>)}</div></section>
    <section id="founding" className="pfOffer"><div><span>FOUNDING 650 OFFER</span><h2>£4.99<small>/month</small></h2><p>Your Pocket Bullseye price stays at £4.99 per month for as long as that founding subscription remains continuously active.</p><ul><li>Exclusive access to the building of the main Bullseye project</li><li>Founder feedback and feature-influence channel</li><li>Intended £12/month main-project founding price when it launches, subject to final terms</li></ul></div><aside><strong>JOIN THE FOUNDING 650</strong><p>Continue to Stripe’s secure checkout to start your £4.99 monthly subscription. You can cancel at any time.</p><form className="waitlistForm" action="/api/stripe/checkout" method="post"><div><button type="submit" name="offering" value="pocket_founding_month">CONTINUE TO SECURE CHECKOUT <span aria-hidden="true">↗</span></button></div></form><small>Places are assigned only after verified successful checkout. Cancelling ends the continuous-price guarantee.</small></aside></section>
    <section className="pfTruth"><article><b>🔒</b><strong>PRIVATE BY DESIGN</strong><p>Remove names, balances and account details before upload.</p></article><article><b>🛡️</b><strong>EVIDENCE, NOT ODDS</strong><p>Percentages describe visible evidence balance—not market probability.</p></article><article><b>⏸</b><strong>PATIENCE COUNTS</strong><p>WAIT and STAND ASIDE are valid, useful outcomes.</p></article></section>
    <footer><p>Speculative educational analysis only. Pocket Bullseye does not provide personalised financial advice, execute trades or guarantee outcomes.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/risk-disclaimer">Risk warning</Link></div></footer>
  </main>;
}
