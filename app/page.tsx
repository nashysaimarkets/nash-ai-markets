import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "./components/BrandLogo";

export const metadata: Metadata = {
  title: "The Market Decision Instrument",
  description:
    "See the market, see what would change the plan, and preserve the decision from pre-market preparation through the closing review.",
  alternates: { canonical: "/" },
};

const readings = [
  ["01", "Trust", "Can the underlying information be used? Live, delayed and unavailable states remain visible."],
  ["02", "Structure", "Where does price sit between verified support, resistance and the rolling range?"],
  ["03", "Evidence", "Which independent market dimensions are present, missing or in conflict?"],
  ["04", "Catalyst", "What scheduled risk could alter the session before the next decision point?"],
  ["05", "Permission", "Do the conditions support bullish preparation, bearish preparation or standing aside?"],
] as const;

const ritual = [
  ["07:30 UK", "Prepare", "Open the verified pre-market brief and inspect what changed."],
  ["Before action", "Confirm", "Require the stated price and evidence conditions before changing posture."],
  ["During session", "Protect", "Keep invalidation, event risk and the stand-aside path visible."],
  ["21:30 UK", "Review", "Compare the preserved plan with the session without rewriting history."],
] as const;

const membership = [
  "Daily S&P 500 decision brief",
  "Bullseye Decision Instrument",
  "Cross-market level matrix",
  "Bullish, bearish and stand-aside paths",
  "Confirmation, invalidation and risk veto",
  "Pre-market and closing-review broadcasts",
  "Immutable brief archive and private journal",
] as const;

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="resetHome launchHome">
      <a className="resetSkip" href="#main-content">Skip to content</a>

      <header className="resetNav launchNav">
        <BrandLogo className="resetBrand" />
        <nav aria-label="Main navigation">
          <a href="#instrument">The instrument</a>
          <a href="#ritual">Daily ritual</a>
          <Link href="/methodology">Methodology</Link>
        </nav>
        <div className="resetNavActions">
          <Link href="/login">Sign in</Link>
          <Link className="resetButton resetButtonSmall" href="/login">
            Open today&apos;s brief <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <div id="main-content">
        <section className="launchHero" aria-labelledby="launch-hero-title">
          <div className="launchHeroAtmosphere" aria-hidden="true" />
          <div className="launchHeroCopy">
            <p className="resetEyebrow"><span /> Public launch · Bullseye BDI-01</p>
            <h1 id="launch-hero-title">See the market.<em>See what changes the plan.</em></h1>
            <p className="launchLead">
              NASH AI Markets is a decision layer for the S&amp;P 500 session.
              It turns verified structure, evidence and event risk into conditional
              paths—then preserves the plan for review after the close.
            </p>
            <div className="resetHeroActions">
              <Link className="resetButton" href="/login">Open today&apos;s brief <span aria-hidden="true">↗</span></Link>
              <a className="resetTextLink" href="#instrument">Explore BDI-01</a>
            </div>
            <ul className="resetPrinciples" aria-label="Product principles">
              <li>Auditable readings</li>
              <li>No hidden score</li>
              <li>Stand aside is valid</li>
            </ul>
          </div>

          <article className="launchInstrument" aria-label="Illustrative Bullseye Decision Instrument">
            <header>
              <div>
                <span>NASH original instrument</span>
                <strong>BDI-01</strong>
              </div>
              <em>Illustrative framework</em>
            </header>
            <div className="launchInstrumentStage">
              <div className="launchInstrumentOrbit" aria-hidden="true"><i /><i /><i /></div>
              <div className="launchInstrumentNeedle" aria-hidden="true"><i /></div>
              <div className="launchInstrumentCore">
                <span>Decision posture</span>
                <strong>Wait for confirmation</strong>
                <small>Permission remains conditional</small>
              </div>
              <span className="launchPole isSupport">Support</span>
              <span className="launchPole isResistance">Resistance</span>
            </div>
            <div className="launchReadout">
              {["Trust", "Structure", "Evidence", "Catalyst", "Permission"].map((label, index) => (
                <span key={label}><i data-tone={index === 3 ? "warning" : "ready"} />{label}</span>
              ))}
            </div>
            <footer>
              <span>NO LIVE MARKET VALUES</span>
              <strong>Five readings · zero mystery score</strong>
            </footer>
          </article>
        </section>

        <div className="launchMarquee" aria-label="NASH AI Markets principles">
          <div>
            <span>TRUST BEFORE INTERPRETATION</span><i>•</i>
            <span>CONDITIONS BEFORE CONVICTION</span><i>•</i>
            <span>INVALIDATION BEFORE ACTION</span><i>•</i>
            <span>PROCESS BEFORE HINDSIGHT</span><i>•</i>
            <span>TRUST BEFORE INTERPRETATION</span><i>•</i>
            <span>CONDITIONS BEFORE CONVICTION</span><i>•</i>
          </div>
        </div>

        <section className="launchManifesto" aria-labelledby="launch-manifesto-title">
          <p className="resetEyebrow">A different category of market tool</p>
          <h2 id="launch-manifesto-title">Your broker shows the price.<br />Your charts show the past.<br /><em>NASH shows the decision.</em></h2>
          <p>
            More information is not the same as better preparation. The Bullseye
            system makes the evidence chain visible: what is trusted, what matters,
            what confirms, what vetoes and what would change the plan.
          </p>
        </section>

        <section className="launchReadings" id="instrument" aria-labelledby="launch-readings-title">
          <header>
            <div>
              <p className="resetEyebrow">Bullseye Decision Instrument · BDI-01</p>
              <h2 id="launch-readings-title">One decision.<br /><em>Five separate readings.</em></h2>
            </div>
            <p>
              The instrument refuses to compress uncertainty into a seductive
              confidence percentage. Every reading keeps its own source and meaning.
            </p>
          </header>
          <div>
            {readings.map(([number, title, detail]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="launchDelta" aria-labelledby="launch-delta-title">
          <div>
            <p className="resetEyebrow">The question most platforms leave unanswered</p>
            <h2 id="launch-delta-title">What would have to happen<br /><em>for the plan to change?</em></h2>
          </div>
          <div className="launchDeltaMap">
            <article data-tone="positive"><span>01 · Bullish confirmation</span><strong>Acceptance + supporting evidence</strong><p>The path stays inactive until its own verified conditions clear.</p></article>
            <article data-tone="negative"><span>02 · Bearish confirmation</span><strong>Rejection + failed recovery</strong><p>The opposite path has a separate evidence test and invalidation.</p></article>
            <article data-tone="warning"><span>03 · Risk veto</span><strong>Freshness, catalyst or conflict</strong><p>Capital protection overrides direction when the evidence chain breaks.</p></article>
            <article data-tone="neutral"><span>04 · Prior-brief delta</span><strong>What actually changed?</strong><p>The current plan is compared with an earlier immutable record.</p></article>
          </div>
          <small>Illustrative framework only · scenarios, not predictions</small>
        </section>

        <section className="launchRitual" id="ritual" aria-labelledby="launch-ritual-title">
          <header>
            <p className="resetEyebrow">From preparation to accountability</p>
            <h2 id="launch-ritual-title">A daily ritual that<br /><em>closes the loop.</em></h2>
          </header>
          <ol>
            {ritual.map(([time, title, detail], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <time>{time}</time>
                <div><h3>{title}</h3><p>{detail}</p></div>
                <i aria-hidden="true">→</i>
              </li>
            ))}
          </ol>
        </section>

        <section className="launchBroadcast" aria-labelledby="launch-broadcast-title">
          <div className="launchBroadcastCopy">
            <p className="resetEyebrow">The market, explained twice</p>
            <h2 id="launch-broadcast-title">Prepare before.<br /><em>Review after.</em></h2>
            <p>
              Human-reviewed AI briefings are scheduled for 07:30 and 21:30 UK
              on weekdays. A prior episode is never presented as today&apos;s.
            </p>
          </div>
          <div className="launchBroadcastTimeline">
            <article><span>07:30</span><strong>Pre-market briefing</strong><p>Conditions, paths, catalysts and risk.</p></article>
            <i aria-hidden="true" />
            <article><span>21:30</span><strong>Closing review</strong><p>What changed, what held and what the process revealed.</p></article>
          </div>
        </section>

        <section className="resetMembership launchMembership" id="membership" aria-labelledby="reset-membership-title">
          <div className="resetMembershipCopy">
            <p className="resetEyebrow">The complete decision layer</p>
            <h2 id="reset-membership-title">Do not buy another prediction.<br />Build a better process.</h2>
            <p>
              The protected member workspace connects preparation, verified
              evidence, conditional paths, decision capture and review.
            </p>
          </div>
          <article className="resetMembershipCard">
            <header>
              <Image src="/brand/logo-mark.svg" width={46} height={46} alt="" />
              <div><span>NASH AI Markets</span><strong>Decision Brief Membership</strong></div>
            </header>
            <ul>
              {membership.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}
            </ul>
            <Link className="resetButton" href="/pricing">View membership <span aria-hidden="true">↗</span></Link>
            <small>Educational market analysis. No execution and no promise of outcomes.</small>
          </article>
        </section>
      </div>

      <footer className="resetFooter">
        <BrandLogo className="resetBrand" />
        <p>See the market. See what changes the plan.</p>
        <nav aria-label="Legal and support">
          <Link href="/methodology">Methodology</Link>
          <Link href="/risk-disclaimer">Risk</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}
