import {
  founding100AvailabilityLabel,
  loadFounding100Availability,
} from "./lib/server/founding-100.ts";

const features = [
  {
    n: "01",
    title: "The overnight picture",
    copy: "Asia, Europe and US futures condensed into the moves that matter before the bell.",
  },
  {
    n: "02",
    title: "Signals with context",
    copy: "Verified cross-market drivers, conflicts and invalidation conditions without fabricated price levels.",
  },
  {
    n: "03",
    title: "A plan, not a prediction",
    copy: "Bull, bear and no-trade cases written for practical futures and options decisions.",
  },
];

const included = [
  "Provider-backed futures and cross-market status",
  "Treasury yields, VIX and US dollar context",
  "Deterministic market-intelligence scores",
  "Bullish, neutral and bearish scenarios",
  "Decision permission and conflict warnings",
  "Clear data-quality and risk status",
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const foundingAvailability = await loadFounding100Availability();
  const proFounding = founding100AvailabilityLabel(foundingAvailability.proRemaining);
  const eliteFounding = founding100AvailabilityLabel(foundingAvailability.eliteRemaining);

  const portalUrl =
    process.env.STRIPE_CUSTOMER_PORTAL_LINK ||
    "mailto:hello@nashaimarkets.com?subject=Manage%20my%20NASH%20AI%20subscription";

  return (
    <main>
      <header className="nav shell">
        <a href="#top" className="brand" aria-label="NASH AI Markets home">
          <span className="mark">
            <i />
          </span>
          <span>
            NASH <b>AI</b> MARKETS
          </span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#brief">The Brief</a>
          <a href="#process">How it works</a>
          <a href="#membership">Membership</a>
          <a href="/terminal">Terminal</a>
          <a href="/login">Member login</a>
          <a href="/waitlist">Waiting list</a>
          <a href="#faq">FAQ</a>
        </nav>

        <a className="navCta" href="#membership">
          Get the brief <span>↗</span>
        </a>
      </header>

      <section className="hero shell" id="top">
        <div className="heroCopy">
          <div className="eyebrow">
            <span /> S&amp;P 500 PRE-MARKET INTELLIGENCE
          </div>

          <h1>
            See the market.
            <br />
            <em>Plan the trade.</em>
          </h1>

          <p className="lead">
            A focused daily S&amp;P 500 futures briefing that cuts through the
            noise — with verified market context, scenarios and risk clearly
            mapped before the US session.
          </p>

          <div className="heroActions">
            <a className="primary" href="#membership">
              Join NASH AI <span>↗</span>
            </a>

            <a className="textLink" href="#brief">
              See what’s inside <span>↓</span>
            </a>

            <a className="textLink" href="/terminal">
              Preview terminal <span>↗</span>
            </a>
          </div>

          <div className="trust">
            <span>✓</span> Clear uncertainty &nbsp; <span>✓</span> No hype
            &nbsp; <span>✓</span> Cancel anytime
          </div>
        </div>

        <div
          className="terminalWrap"
          aria-label="Example daily market briefing"
        >
          <div className="glow" />

          <div className="terminal">
            <div className="termTop">
              <div>
                <i />
                <i />
                <i />
              </div>
              <span>NASH AI / DAILY BRIEF</span>
              <b>PREVIEW</b>
            </div>

            <div className="termDate">
              <span>MONDAY / PRE-MARKET</span>
              <strong>
                07:00 <small>UK</small>
              </strong>
            </div>

            <div className="riskRow">
              <span>SESSION RISK</span>
              <b>● ELEVATED</b>
            </div>

            <div className="metricGrid">
              <div>
                <small>ES FUTURES</small>
                <strong>PREVIEW</strong>
                <em>NO LIVE VALUE</em>
              </div>

              <div>
                <small>VIX</small>
                <strong>PREVIEW</strong>
                <em>NO LIVE VALUE</em>
              </div>

              <div>
                <small>10Y YIELD</small>
                <strong>PREVIEW</strong>
                <em>NO LIVE VALUE</em>
              </div>

              <div>
                <small>US DOLLAR</small>
                <strong>PREVIEW</strong>
                <em>NO LIVE VALUE</em>
              </div>
            </div>

            <div className="levels">
              <div className="levelsTitle">
                <span>SAFETY WORKFLOW</span>
                <small>PRODUCT PREVIEW</small>
              </div>

              <div className="level">
                <span>01</span>
                <b>VERIFY</b>
                <i />
                <em>Provider and timestamp</em>
              </div>

              <div className="level active">
                <span>02</span>
                <b>ASSESS</b>
                <i />
                <em>Aligned and conflicting drivers</em>
              </div>

              <div className="level">
                <span>03</span>
                <b>DECIDE</b>
                <i />
                <em>Actionable, caution or no-trade</em>
              </div>

              <div className="level">
                <span>04</span>
                <b>REVIEW</b>
                <i />
                <em>Warnings and invalidation</em>
              </div>
            </div>

            <div className="bias">
              <span>TODAY’S BIAS</span>
              <b>AWAIT VERIFIED DATA</b>
              <p>
                This product preview contains no current market value,
                directional signal or fabricated price level.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="ticker">
        <div>
          FUTURES <b>•</b> OPTIONS <b>•</b> LEVELS <b>•</b> VOLATILITY{" "}
          <b>•</b> MACRO <b>•</b> RISK FIRST <b>•</b> FUTURES <b>•</b>{" "}
          OPTIONS <b>•</b> LEVELS
        </div>
      </div>

      <section className="section shell" id="brief">
        <div className="sectionHead">
          <div>
            <span className="kicker">YOUR DAILY EDGE</span>
            <h2>
              Everything that matters.
              <br />
              <em>Nothing that doesn’t.</em>
            </h2>
          </div>

          <p>
            Built for traders who want a structured view before the market
            opens — without spending hours piecing it together.
          </p>
        </div>

        <div className="featureGrid">
          {features.map((feature) => (
            <article key={feature.n}>
              <span>{feature.n}</span>
              <div className="iconLine" />
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sample shell" id="sample">
        <div className="sampleHead">
          <span className="kicker">INSIDE THE DAILY BRIEF</span>
          <h2>
            Three scenarios.
            <br />
            <em>One disciplined plan.</em>
          </h2>
          <p>
            A representative example of how each session is framed. Levels
            shown are illustrative—not live market data.
          </p>
        </div>

        <div className="scenarioGrid">
          <article className="bull">
            <div>
              <span>01</span>
              <b>BULL CASE</b>
            </div>
            <h3>Acceptance above resistance</h3>
            <p>
              Buyers hold the daily pivot and establish value above first
              resistance. Momentum improves if breadth confirms.
            </p>
            <ul>
              <li>Trigger: sustained trade above R1</li>
              <li>Invalidation: rejection back below pivot</li>
              <li>Risk: chasing an opening spike</li>
            </ul>
          </article>

          <article className="bear">
            <div>
              <span>02</span>
              <b>BEAR CASE</b>
            </div>
            <h3>Failed breakout and reversal</h3>
            <p>
              Price rejects resistance, loses the pivot and sellers gain
              control toward first support.
            </p>
            <ul>
              <li>Trigger: pivot loss with confirmation</li>
              <li>Invalidation: reclaim and hold above R1</li>
              <li>Risk: shorting directly into support</li>
            </ul>
          </article>

          <article className="neutral">
            <div>
              <span>03</span>
              <b>NO-TRADE CASE</b>
            </div>
            <h3>Range without confirmation</h3>
            <p>
              Price remains trapped between key levels while volatility and
              volume offer no clear advantage.
            </p>
            <ul>
              <li>Condition: repeated pivot whipsaws</li>
              <li>Response: reduce size or stand aside</li>
              <li>Priority: protect mental capital</li>
            </ul>
          </article>
        </div>

        <p className="sampleNote">
          ILLUSTRATIVE FORMAT ONLY · NOT A CURRENT SIGNAL OR RECOMMENDATION
        </p>
      </section>

      <section className="process" id="process">
        <div className="shell">
          <div className="processIntro">
            <span className="kicker">FROM NOISE TO PLAN</span>
            <h2>
              Your morning,
              <br />
              <em>mapped in minutes.</em>
            </h2>
            <p>
              One concise dashboard available before the US session when
              verified provider data is available. Review the conditions,
              warnings and scenarios that matter.
            </p>
          </div>

          <div className="steps">
            <article>
              <b>06:30–07:00</b>
              <span>01</span>
              <h3>Markets scanned</h3>
              <p>
                Overnight moves, macro catalysts, volatility and cross-market
                signals are reviewed.
              </p>
            </article>

            <article>
              <b>MEMBER DASHBOARD</b>
              <span>02</span>
              <h3>Your brief is ready</h3>
              <p>
                Sign in to review the current provider status, deterministic
                scenarios, decision permission and risk warnings.
              </p>
            </article>

            <article>
              <b>YOUR DECISION</b>
              <span>03</span>
              <h3>Trade—or stand aside</h3>
              <p>
                Use the plan to prepare your own entries, risk and no-trade
                conditions. Discipline comes first.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="membership" id="membership">
        <div className="shell pricingIntro">
          <span className="kicker">CHOOSE YOUR EDGE</span>
          <h2>
            Start every session
            <br />
            <em>with a plan.</em>
          </h2>
          <p className="memberLead">
            Start free, or unlock the full daily intelligence built for active
            futures and options traders. Upgrade, downgrade or cancel anytime.
          </p>
        </div>

        <div className="shell pricingGrid">
          <article className="tierCard">
            <p>FREE</p>
            <div className="tierPrice">
              <span>£</span>
              <strong>0</strong>
              <small>/ month</small>
            </div>
            <p className="tierCopy">
              A clear first look at the NASH AI approach.
            </p>
            <ul>
              <li>
                <span>✓</span>Weekly market outlook
              </li>
              <li>
                <span>✓</span>Selected key levels
              </li>
              <li>
                <span>✓</span>Market education updates
              </li>
            </ul>
            <a
              className="tierButton"
              href="/login"
            >
              Start free <span>↗</span>
            </a>
          </article>

          <article className="tierCard featured">
            <div className="tag">MOST POPULAR</div>
            <p>PRO</p>
            <div className={`foundingOffer${proFounding.full ? " foundingOfferFull" : ""}`} aria-live="polite"><strong>FOUNDING 100 PRO</strong><b>{proFounding.label}</b><span>{proFounding.detail}</span></div>
            <div className="tierPrice">
              <span>£</span>
              <strong>14.99</strong>
              <small>/ month</small>
            </div>
            <p className="tierCopy">
              The complete pre-market plan, every trading day.
            </p>
            <ul>
              {included.map((item) => (
                <li key={item}>
                  <span>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <a className="primary full" href="/pricing">
              Compare Pro billing <span>↗</span>
            </a>
          </article>

          <article className="tierCard">
            <p>ELITE</p>
            <div className={`foundingOffer${eliteFounding.full ? " foundingOfferFull" : ""}`} aria-live="polite"><strong>FOUNDING 100 ELITE</strong><b>{eliteFounding.label}</b><span>{eliteFounding.detail}</span></div>
            <div className="tierPrice">
              <span>£</span>
              <strong>29.99</strong>
              <small>/ month</small>
            </div>
            <p className="tierCopy">
              Everything in Pro, with deeper options-focused intelligence.
            </p>
            <ul>
              <li>
                <span>✓</span>Everything included in Pro
              </li>
              <li>
                <span>✓</span>Daily options setup
              </li>
              <li>
                <span>✓</span>Expanded volatility context
              </li>
              <li>
                <span>✓</span>Priority product access
              </li>
            </ul>
            <a className="tierButton" href="/pricing">
              Compare Elite billing <span>↗</span>
            </a>
          </article>
        </div>

        <p className="shell pricingSafety">
          EDUCATIONAL MARKET COMMENTARY ONLY · NO GUARANTEED OUTCOMES · CANCEL
          ANYTIME
        </p>
        <aside className="shell foundingTerms" aria-label="Founding 100 terms">
          <strong>Founding 100 price protection</strong>
          <p>Eligibility is awarded automatically after a successful subscription and is limited to 100 members in each paid tier. The checkout subscription price is locked for life while that same membership remains continuously active. If it is cancelled or lapses, the price lock is permanently lost and any future subscription uses the standard price available at that time.</p>
        </aside>
      </section>

      <section className="about shell" id="about">
        <span className="kicker">BUILT FOR REAL TRADERS</span>
        <div>
          <h2>
            Less noise.
            <br />
            Better decisions.
          </h2>
          <p>
            NASH AI Markets turns complex market information into a clear,
            practical pre-market plan. We don’t promise certainty. We show the
            levels, the scenarios and the risk — so you can make your own
            informed decisions.
          </p>
        </div>
      </section>

      <section className="faq shell" id="faq">
        <div className="faqTitle">
          <span className="kicker">STRAIGHT ANSWERS</span>
          <h2>Before you join.</h2>
        </div>

        <div className="faqList">
          <details>
            <summary>
              Is this financial advice?<span>+</span>
            </summary>
            <p>
              No. NASH AI Markets provides general educational commentary and
              market analysis. It does not take account of your personal
              circumstances or tell you what you should buy or sell.
            </p>
          </details>

          <details>
            <summary>
              When will I receive the brief?<span>+</span>
            </summary>
            <p>
              The aim is to deliver each briefing before the main US trading
              session, giving you time to review the key levels, scheduled
              events and scenarios.
            </p>
          </details>

          <details>
            <summary>
              Is it suitable for beginners?<span>+</span>
            </summary>
            <p>
              The clear format is accessible, but futures and options are
              complex, high-risk products. You should understand the
              instruments and practise risk management before trading with
              real money.
            </p>
          </details>

          <details>
            <summary>
              Does NASH AI guarantee profitable trades?<span>+</span>
            </summary>
            <p>
              No—and no credible service can. The brief helps you prepare for
              multiple outcomes and clearly states uncertainty. Losses are
              always possible.
            </p>
          </details>

          <details>
            <summary>
              Can I cancel at any time?<span>+</span>
            </summary>
            <p>
              Yes. Monthly and annual memberships are managed securely through
              Stripe. Cancellation ends future renewal. A cancelled or lapsed
              Founding subscription permanently loses its price lock.
            </p>
          </details>
        </div>
      </section>

      <footer>
        <div className="shell footerTop">
          <div className="brand">
            <span className="mark">
              <i />
            </span>
            <span>
              NASH <b>AI</b> MARKETS
            </span>
          </div>

          <div className="footerLinks">
            <a href="#brief">The Brief</a>
            <a href="#membership">Membership</a>
            <a href="/waitlist">Private beta waiting list</a>
            <a href={portalUrl}>Manage subscription</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/risk-disclaimer">Risk disclaimer</a>
                <a href="/about">About</a>
                <a href="/help">Help</a>
                <a href="/contact">Contact</a>
            <a href="mailto:hello@nashaimarkets.com">
              hello@nashaimarkets.com
            </a>
          </div>
        </div>

        <div className="shell disclaimer">
          Trading futures and options involves substantial risk and is not
          suitable for everyone. NASH AI Markets provides educational market
          commentary only and does not provide personal financial advice,
          investment recommendations or guaranteed outcomes. Past performance
          is not indicative of future results.
          <span>© 2026 NASH AI Markets</span>
        </div>
      </footer>
    </main>
  );
}
