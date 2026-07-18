import type { CSSProperties } from "react";
import {
  founding100AvailabilityLabel,
  loadFounding100Availability,
} from "./lib/server/founding-100.ts";

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
    action: "Compare Pro billing",
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
    action: "Compare Elite billing",
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

  return (
    <main className="mcHome">
      <a className="mcSkip" href="#main-content">Skip to content</a>

      <header className="mcNav">
        <a href="#top" className="mcBrand" aria-label="NASH AI Markets home">
          <span className="mcBrandMark" aria-hidden="true"><i /></span>
          <span>NASH <b>AI</b> MARKETS</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Method</a>
          <a href="#membership">Membership</a>
          <a href="/terminal">Terminal</a>
        </nav>
        <div className="mcNavActions">
          <a href="/login">Sign in</a>
          <a className="mcButton mcButtonSmall" href="#membership">Get access <span>↗</span></a>
        </div>
      </header>

      <div id="main-content">
        <section className="mcHero" id="top">
          <div className="mcHeroAtmosphere" aria-hidden="true" />
          <div className="mcHeroGrid">
            <div className="mcHeroCopy">
              <p className="mcEyebrow"><span /> Pre-market mission control</p>
              <h1>Trade preparation,<br /><em>with a clear head.</em></h1>
              <p className="mcLead">
                NASH AI Markets turns verified market context into conditional
                scenarios, decision permissions and risk-aware plans for the
                S&amp;P 500 session.
              </p>
              <div className="mcHeroActions">
                <a className="mcButton" href="/login">Start free <span>↗</span></a>
                <a className="mcTextLink" href="#platform">Explore the platform <span>↓</span></a>
              </div>
              <ul className="mcTrust" aria-label="Platform principles">
                <li><i /> Evidence before opinion</li>
                <li><i /> Scenarios, not predictions</li>
                <li><i /> Risk always visible</li>
              </ul>
            </div>

            <div className="mcPreviewFrame">
              <div className="mcPreviewGlow" aria-hidden="true" />
              <article className="mcTerminal" aria-label="Illustrative NASH AI Mission Control dashboard preview">
                <header className="mcTerminalTop">
                  <div className="mcTerminalIdentity">
                    <span className="mcReticle" aria-hidden="true" />
                    <div><b>MISSION CONTROL</b><small>S&amp;P 500 / PRE-MARKET</small></div>
                  </div>
                  <span className="mcPreviewBadge">PRODUCT PREVIEW</span>
                </header>
                <div className="mcStatusBar">
                  <span><i /> SYSTEM READY</span>
                  <span>ILLUSTRATIVE · NO LIVE VALUE</span>
                </div>
                <div className="mcTerminalBody">
                  <section className="mcChartPanel">
                    <header><div><small>SESSION STRUCTURE</small><strong>Scenario map</strong></div><span>PRE-MARKET</span></header>
                    <div className="mcChart" aria-hidden="true">
                      <div className="mcChartGrid" />
                      <svg viewBox="0 0 640 260" role="presentation" focusable="false">
                        <defs>
                          <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#62f6ad" stopOpacity=".24" />
                            <stop offset="100%" stopColor="#62f6ad" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path className="mcArea" d="M0 228 C55 220 72 178 116 185 S180 142 224 157 S299 105 344 121 S420 75 464 96 S540 42 640 57 L640 260 L0 260 Z" />
                        <path className="mcLine" pathLength="1" d="M0 228 C55 220 72 178 116 185 S180 142 224 157 S299 105 344 121 S420 75 464 96 S540 42 640 57" />
                      </svg>
                      <div className="mcChartTag mcChartTagRisk">EVENT RISK</div>
                      <div className="mcChartTag mcChartTagPivot">DECISION ZONE</div>
                    </div>
                    <footer><span>Data state</span><b>Await verified session</b></footer>
                  </section>
                  <aside className="mcDecisionPanel">
                    <header><small>DECISION PERMISSION</small><span className="mcPulse">ASSESS</span></header>
                    <div className="mcGauge" style={{ "--gauge": "72%" } as CSSProperties}>
                      <div><strong>72</strong><span>CONTEXT SCORE</span></div>
                    </div>
                    <dl>
                      <div><dt>Trend</dt><dd>Conditional</dd></div>
                      <div><dt>Volatility</dt><dd>Monitor</dd></div>
                      <div><dt>Conflict</dt><dd>Visible</dd></div>
                    </dl>
                    <p>No directional output is presented until source data and conditions are verified.</p>
                  </aside>
                </div>
                <footer className="mcTerminalFooter">
                  {["Context", "Scenarios", "Invalidation", "Risk"].map((item, index) => (
                    <span key={item}><b>0{index + 1}</b>{item}</span>
                  ))}
                </footer>
              </article>
              <p className="mcPreviewNote">Interface preview · Illustrative values and states only</p>
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
              <p>Eligibility is awarded automatically after a successful subscription and is limited to 100 members in each paid tier. The checkout subscription price is locked for life while that same membership remains continuously active. If it is cancelled or lapses, the price lock is permanently lost and any future subscription uses the standard price available at that time.</p>
            </aside>
          </div>
        </section>

        <section className="mcPrinciple">
          <p className="mcEyebrow">Our operating principle</p>
          <blockquote>“The objective is not to predict every move. It is to arrive prepared for the moves that matter.”</blockquote>
          <p>NASH AI Markets supports preparation and risk awareness. It does not provide personal financial advice or promise trading outcomes.</p>
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

      <footer className="mcFooter">
        <div className="mcFooterTop">
          <a href="#top" className="mcBrand" aria-label="Back to top"><span className="mcBrandMark" aria-hidden="true"><i /></span><span>NASH <b>AI</b> MARKETS</span></a>
          <p>Structured market preparation for traders who value evidence, scenarios and risk awareness.</p>
          <div><a href="/terminal">Terminal</a><a href="/pricing">Pricing</a><a href="/waitlist">Launch waiting list</a><a href="/about">About</a><a href="/help">Help</a><a href="/contact">Contact</a></div>
          <div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/risk-disclaimer">Risk disclaimer</a><a href={portalUrl}>Manage subscription</a></div>
        </div>
        <div className="mcFooterBottom">
          <p>Trading futures and options involves substantial risk and is not suitable for everyone. Educational market commentary only. No guaranteed outcomes.</p>
          <span>© 2026 NASH AI Markets</span>
        </div>
      </footer>
    </main>
  );
}
