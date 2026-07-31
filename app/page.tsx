import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "./components/BrandLogo.tsx";
import { ConversionMetrics } from "./components/ConversionMetrics.tsx";
import {
  founding100AvailabilityLabel,
  loadFounding100Availability,
} from "./lib/server/founding-100.ts";

export const metadata: Metadata = {
  title: "S&P 500 Pre-Market Intelligence",
  description:
    "Build a calmer S&P 500 pre-market routine with verified context, conditional scenarios, visible event risk and clear decision permissions.",
  alternates: { canonical: "/" },
};

const intelligenceLayers = [
  {
    number: "01",
    label: "Context",
    title: "Start with the whole session",
    copy: "Overnight markets, scheduled catalysts and cross-asset conditions are organised into one calm pre-market view.",
  },
  {
    number: "02",
    label: "Scenarios",
    title: "Prepare for more than one outcome",
    copy: "Bull, bear and stand-aside cases make the conditions, conflicts and invalidation logic visible before a decision.",
  },
  {
    number: "03",
    label: "Risk",
    title: "Know when not to act",
    copy: "Data quality, event risk and decision permission remain prominent, especially when the evidence is incomplete.",
  },
];

const workflow = [
  ["Verify", "Provider, timestamp and data quality"],
  ["Assess", "Aligned drivers and active conflicts"],
  ["Plan", "Conditional scenarios and invalidation"],
  ["Decide", "Act, reduce risk or stand aside"],
];

const trustStandards = [
  ["Provider visibility", "Every member view keeps source status, freshness and unavailable states visible."],
  ["Fail-closed decisions", "Incomplete evidence never becomes a fabricated signal, score or market level."],
  ["Secure membership", "Checkout and subscription management are handled through Stripe-hosted billing."],
  ["Risk-first language", "Scenarios remain conditional and educational, with no promise of trading outcomes."],
] as const;

const feedbackThemes = [
  {
    quote: "I want one repeatable place to review context, catalysts and invalidation before the session.",
    role: "Active index trader",
  },
  {
    quote: "The most useful decision is sometimes a clear reason to wait rather than force a setup.",
    role: "Risk-focused futures trader",
  },
  {
    quote: "Show me what is verified, what conflicts and what would change the plan.",
    role: "Process-led options trader",
  },
] as const;

const eliteReasons = [
  ["01", "One decision hierarchy", "Move from provider state to scenarios, risk and next action without stitching together disconnected tools."],
  ["02", "Full planning depth", "Review confirmations, invalidation and no-trade conditions alongside the evidence that produced them."],
  ["03", "Provider transparency", "Keep freshness, availability and incomplete-input warnings visible throughout the workflow."],
  ["04", "Diagnostic confidence", "Inspect sanitised provider health and engine synchronisation without exposing credentials or secrets."],
  ["05", "Conditional thinking", "Prepare for competing market paths instead of treating one directional view as certainty."],
  ["06", "Risk-aware restraint", "Preserve stand-aside as a valid outcome when evidence, volatility or event risk conflicts."],
] as const;

const trustBadges = [
  ["Secure Payments", "Stripe-hosted checkout"],
  ["Live Data Labels", "Freshness stays visible"],
  ["Professional Analysis", "Evidence-led scenarios"],
] as const;

const included = [
  "Provider-backed futures and cross-market status",
  "Treasury yields, volatility and US dollar context",
  "Deterministic market-intelligence scores",
  "Bullish, neutral and bearish scenarios",
  "Decision permission and conflict warnings",
  "Clear data-quality and risk status",
];

const plans = [
  {
    name: "Free",
    price: "0",
    copy: "Explore the planning workflow and build a more structured market routine.",
    features: ["Weekly market outlook", "Selected key levels", "Market education updates"],
    action: "Start free",
    href: "/login",
  },
  {
    name: "Pro",
    price: "14.99",
    copy: "The complete pre-market planning workspace for active traders.",
    features: included,
    action: "Start Pro Membership",
    href: "/pricing",
    featured: true,
  },
  {
    name: "Elite",
    price: "29.99",
    copy: "Deeper options-focused context for a more advanced preparation process.",
    features: [
      "Everything included in Pro",
      "Daily options setup",
      "Expanded volatility context",
      "Priority product access",
    ],
    action: "Unlock Elite",
    href: "/pricing",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const foundingAvailability = await loadFounding100Availability();
  const proFounding = founding100AvailabilityLabel(foundingAvailability.proRemaining);
  const eliteFounding = founding100AvailabilityLabel(foundingAvailability.eliteRemaining);
  const foundingByPlan = { Pro: proFounding, Elite: eliteFounding };
  const portalUrl =
    process.env.STRIPE_CUSTOMER_PORTAL_LINK ||
    "mailto:hello@nashaimarkets.com?subject=Manage%20my%20NASH%20AI%20subscription";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NASH AI Markets",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: "https://www.nashaimarkets.com/",
    description:
      "Pre-market planning software for verified context, conditional scenarios and visible trading risk.",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "GBP" },
      { "@type": "Offer", name: "Pro", price: "14.99", priceCurrency: "GBP" },
      { "@type": "Offer", name: "Elite", price: "29.99", priceCurrency: "GBP" },
    ],
  };

  return (
    <main className="mcHome">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <a className="mcSkip" href="#main-content">Skip to content</a>

      <header className="mcNav">
        <BrandLogo className="mcBrandLogo" />
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Method</a>
          <a href="#membership">Membership</a>
          <Link href="/terminal">Terminal</Link>
        </nav>
        <div className="mcNavActions">
          <Link href="/login">Sign in</Link>
          <a className="mcButton mcButtonSmall" href="#membership">Get access <span>↗</span></a>
        </div>
      </header>

      <div id="main-content">
        <section className="mcHero" id="top">
          <div className="mcHeroAtmosphere" aria-hidden="true" />
          <div className="mcHeroGrid">
            <div className="mcHeroCopy">
              <p className="mcEyebrow"><span /> Professional pre-market intelligence</p>
              <h1>Prepare Smarter.<br /><em>Trade Better.</em></h1>
              <p className="mcLead">
                Professional S&amp;P 500 futures and options intelligence—organised
                into one calm daily plan before the US session.
              </p>
              <p className="mcValueLine">
                Verified market context · Bullish, bearish and stand-aside scenarios ·
                Key levels and event risk · Clear uncertainty and risk warnings
              </p>
              <div className="mcHeroActions">
                <a className="mcButton" href="#membership">Start Your Membership <span>↗</span></a>
                <a className="mcTextLink" href="/terminal">View the platform <span>↗</span></a>
              </div>
              <ul className="mcTrust" aria-label="Platform principles">
                <li><i /> Evidence before opinion</li>
                <li><i /> Scenarios, not predictions</li>
                <li><i /> Risk always visible</li>
              </ul>
            </div>

            <div className="mcPreviewFrame">
              <div className="mcPreviewGlow" aria-hidden="true" />
              <article className="mcMissionPreview" aria-labelledby="sample-mission-title">
                <header className="mcMissionHeader">
                  <div>
                    <span className="mcMissionKicker">Illustrative member briefing</span>
                    <h2 id="sample-mission-title">Today&apos;s Sample Mission</h2>
                  </div>
                  <Image className="mcMissionMark" src="/brand/logo-mark.svg" width={48} height={48} alt="" />
                </header>
                <div className="mcMissionSummary">
                  <div className="mcMissionStance">
                    <small>Market stance</small>
                    <strong>WAIT FOR CONFIRMATION</strong>
                  </div>
                  <div className="mcReadiness">
                    <small>Readiness Score</small>
                    <strong>72 <span>/ 100</span></strong>
                  </div>
                </div>
                <dl className="mcMissionFacts">
                  <div><dt>Key level</dt><dd>Decision zone</dd></div>
                  <div><dt>Main risk</dt><dd>Scheduled event volatility</dd></div>
                </dl>
                <p className="mcMissionExplanation">
                  Bullseye combines verified context, market structure, volatility,
                  event risk and conflicting evidence before allowing a directional
                  conclusion.
                </p>
                <div className="mcMissionScenarios" aria-label="Illustrative scenarios">
                  <article data-tone="positive"><span>Bull case</span><p>Wait for upside acceptance and confirming evidence.</p></article>
                  <article data-tone="negative"><span>Bear case</span><p>Wait for rejection and a verified loss of structure.</p></article>
                  <article data-tone="neutral"><span>Stand aside</span><p>Protect capital while evidence remains conflicted.</p></article>
                </div>
                <div className="mcMissionLocked">
                  <div aria-hidden="true"><span /><span /><span /></div>
                  <p><strong>Member intelligence continues</strong>Unlock the full plan, invalidation framework and risk checklist.</p>
                  <a href="#membership">Start membership <span>↗</span></a>
                </div>
                <footer>Illustrative example · Not live market data · Not a recommendation <span>NO LIVE VALUE</span></footer>
              </article>
            </div>
          </div>
        </section>

        <section className="mcSignalStrip" aria-label="NASH AI planning principles">
          <div>
            {["Verify the data", "Map the scenarios", "Define invalidation", "Respect event risk", "Protect capital", "Know when to wait"].map((item) => (
              <span key={item}>{item}<i>◆</i></span>
            ))}
          </div>
        </section>

        <section className="mcProof" aria-labelledby="trust-title">
          <header>
            <p className="mcEyebrow">Trust is a product feature</p>
            <h2 id="trust-title">Professional intelligence should show its limits.</h2>
            <p>Credibility starts with transparent inputs, explicit uncertainty and a safe response when verified data is not available.</p>
          </header>
          <div className="mcProofGrid">
            {trustStandards.map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mcTrustBadges" aria-label="Platform trust indicators">
          {trustBadges.map(([title, copy], index) => <article key={title}><i aria-hidden="true">{index === 0 ? "S" : index === 1 ? "L" : "P"}</i><div><strong>{title}</strong><span>{copy}</span></div><b aria-hidden="true">✓</b></article>)}
        </section>

        <section className="mcSection mcPlatform" id="platform">
          <header className="mcSectionHead">
            <div><p className="mcEyebrow">A better pre-market routine</p><h2>From market noise<br />to <em>decision clarity.</em></h2></div>
            <p>NASH AI brings the essential context, competing scenarios and risk conditions into one consistent workflow—without presenting uncertainty as certainty.</p>
          </header>
          <div className="mcLayerGrid">
            {intelligenceLayers.map((item) => (
              <article key={item.number}>
                <header><span>{item.number}</span><small>{item.label}</small></header>
                <div className={`mcLayerVisual mcLayerVisual${item.number}`} aria-hidden="true"><i /><i /><i /></div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mcWorkflow" id="workflow">
          <div className="mcWorkflowInner">
            <div className="mcWorkflowCopy">
              <p className="mcEyebrow">The Bullseye method</p>
              <h2>A repeatable process<br />for an <em>unpredictable market.</em></h2>
              <p>Each stage is designed to slow down weak assumptions and make the evidence behind a decision easier to review.</p>
              <a className="mcTextLink" href="/terminal">Open terminal preview <span>↗</span></a>
            </div>
            <ol className="mcWorkflowSteps">
              {workflow.map(([title, copy], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div><h3>{title}</h3><p>{copy}</p></div>
                  <i aria-hidden="true">↗</i>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mcEliteReasons" aria-labelledby="elite-reasons-title">
          <header><div><p className="mcEyebrow">Why traders choose Elite</p><h2 id="elite-reasons-title">More depth where<br /><em>discipline matters.</em></h2></div><p>Elite extends the daily dashboard into a complete evidence, planning and diagnostic workflow. It does not promise outcomes or remove market risk.</p></header>
          <div>{eliteReasons.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><Link href="/pricing" aria-label={`Compare Elite membership for ${title}`}>Explore Elite <b aria-hidden="true">→</b></Link></article>)}</div>
        </section>

        <ConversionMetrics />

        <section className="mcSection mcScenarios" id="brief">
          <header className="mcSectionHead">
            <div><p className="mcEyebrow">Built for conditional thinking</p><h2>Three valid paths.<br /><em>No forced trade.</em></h2></div>
            <p>Representative scenarios show how the platform frames possible conditions. They are not current signals, recommendations or live market levels.</p>
          </header>
          <div className="mcScenarioGrid">
            <article data-tone="positive"><span>01 / BULL CASE</span><h3>Acceptance and confirmation</h3><p>Define the evidence required for an upside scenario and the condition that would invalidate it.</p><footer><b>Requires</b><span>Structure + breadth</span></footer></article>
            <article data-tone="negative"><span>02 / BEAR CASE</span><h3>Rejection and loss of structure</h3><p>Prepare for weakness without assuming it, with clear confirmation and nearby risk conditions.</p><footer><b>Requires</b><span>Rejection + follow-through</span></footer></article>
            <article data-tone="neutral"><span>03 / STAND ASIDE</span><h3>Conflicting evidence</h3><p>Treat waiting as a valid decision when price, volatility or event risk offers no clear planning advantage.</p><footer><b>Response</b><span>Observe + reassess</span></footer></article>
          </div>
          <p className="mcDisclosure">ILLUSTRATIVE FORMAT ONLY · NO LIVE VALUE · NOT A CURRENT SIGNAL OR RECOMMENDATION</p>
        </section>

        <section className="mcMembership" id="membership">
          <div className="mcMembershipInner">
            <header className="mcSectionHead">
              <div><p className="mcEyebrow">Membership</p><h2>Choose the workspace<br />for <em>your routine.</em></h2></div>
              <p>Start free or unlock the full daily intelligence workflow. Upgrade, downgrade or cancel through secure Stripe billing.</p>
            </header>
            <div className="mcPlanGrid">
              {plans.map((plan) => {
                const founding = foundingByPlan[plan.name as keyof typeof foundingByPlan];
                const foundingLabel =
                  plan.name === "Pro"
                    ? proFounding.label
                    : plan.name === "Elite"
                      ? eliteFounding.label
                      : null;
                return (
                  <article key={plan.name} className={plan.featured ? "mcPlanFeatured" : undefined}>
                    <header><span>{plan.name}</span>{plan.featured && <b>Most popular</b>}</header>
                    {founding && (
                      <div className={`mcFounding${founding.full ? " mcFoundingFull" : ""}`} aria-live="polite">
                        <strong>FOUNDING 100 {plan.name.toUpperCase()}</strong>
                            <span>{foundingLabel}</span>
                        <small>{founding.detail}</small>
                      </div>
                    )}
                    <div className="mcPrice"><sup>£</sup><strong>{plan.price}</strong><span>/ month</span></div>
                    <p>{plan.copy}</p>
                    <ul>{plan.features.map((feature) => <li key={feature}><i />{feature}</li>)}</ul>
                    <a className={plan.featured ? "mcButton" : "mcPlanButton"} href={plan.href}>{plan.action}<span>↗</span></a>
                  </article>
                );
              })}
            </div>
            <p className="mcPlanSafety">EDUCATIONAL MARKET COMMENTARY ONLY · NO GUARANTEED OUTCOMES · CANCEL ANYTIME</p>
            <aside className="mcFoundingTerms" aria-label="Founding 100 terms">
              <strong>Founding 100 price protection</strong>
              <p>Limited to the first 100 continuously active subscribers in each paid tier. The checkout price remains locked for life while that same membership remains continuously active. If it is cancelled or lapses, the price lock is permanently lost, that price protection ends and any future subscription uses the standard price available at that time.</p>
            </aside>
          </div>
        </section>

        <section className="mcPrinciple">
          <p className="mcEyebrow">Our operating principle</p>
          <blockquote>“The objective is not to predict every move. It is to arrive prepared for the moves that matter.”</blockquote>
          <p>NASH AI Markets supports preparation and risk awareness. It does not provide personal financial advice or promise trading outcomes.</p>
        </section>

        <section className="mcVoices" aria-labelledby="feedback-title">
          <header>
            <p className="mcEyebrow">Member stories</p>
            <h2 id="feedback-title">Trust earned before testimonials are published.</h2>
            <p>These premium story slots remain placeholders until feedback, attribution and publication permission are verified. No endorsement has been invented.</p>
          </header>
          <div>
            {feedbackThemes.map((item) => (
              <figure key={item.role} className="mcTestimonialPlaceholder">
                <div className="mcPlaceholderIdentity" aria-hidden="true"><i /><span><b /><b /></span></div>
                <blockquote aria-label="Verified testimonial placeholder">“Verified member story reserved.”</blockquote>
                <p>{item.quote}</p>
                <figcaption>{item.role}<span>Research theme · not an endorsement</span></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mcFaq" id="faq">
          <div><p className="mcEyebrow">Clear answers</p><h2>Before you begin.</h2><p>Futures and options are complex, high-risk products. Understanding the limits of any analysis is part of a sound process.</p></div>
          <div>
            <details><summary>Is this financial advice?<span>+</span></summary><p>No. NASH AI Markets provides general educational commentary and market analysis. It does not consider your personal circumstances or tell you what to buy or sell.</p></details>
            <details><summary>Does NASH AI predict profitable trades?<span>+</span></summary><p>No. No credible service can guarantee trading outcomes. The platform helps you prepare for multiple possibilities and makes uncertainty explicit. Losses are always possible.</p></details>
            <details><summary>When is the market brief available?<span>+</span></summary><p>The aim is to make the briefing available before the main US session when verified provider data is available, giving you time to review scenarios, scheduled events and risks.</p></details>
            <details><summary>Can I cancel at any time?<span>+</span></summary><p>Yes. Monthly and annual memberships are managed securely through Stripe. Cancellation ends future renewal. A cancelled or lapsed Founding subscription permanently loses its price lock.</p></details>
          </div>
        </section>

        <section className="mcFinalCta">
          <div><p className="mcEyebrow">Your next session starts here</p><h2>Prepare with purpose.<br /><em>Decide with discipline.</em></h2></div>
          <a className="mcButton" href="/login">Enter Mission Control <span>↗</span></a>
        </section>
      </div>

      <aside className="mcStickyCta" aria-label="Membership call to action"><div><strong>Build a calmer pre-market routine</strong><span>Free, Pro and Elite access available</span></div><a href="#membership">Compare plans <span aria-hidden="true">→</span></a></aside>

      <footer className="mcFooter">
        <div className="mcFooterTop">
          <a href="#top" className="mcBrand" aria-label="Back to top"><span className="mcBrandMark" aria-hidden="true"><i /></span><span>NASH <b>AI</b> MARKETS</span></a>
          <p>Structured market preparation for traders who value evidence, scenarios and risk awareness.</p>
          <div><Link href="/terminal">Terminal</Link><Link href="/pricing">Pricing</Link><Link href="/waitlist">Launch waiting list</Link><Link href="/about">About</Link><Link href="/help">Help</Link><Link href="/contact">Contact</Link></div>
          <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/risk-disclaimer">Risk disclaimer</Link><a href={portalUrl}>Manage subscription</a></div>
        </div>
        <div className="mcFooterBottom">
          <p>Trading futures and options involves substantial risk and is not suitable for everyone. Educational market commentary only. No guaranteed outcomes.</p>
          <span>© 2026 NASH AI Markets</span>
        </div>
      </footer>
    </main>
  );
}
