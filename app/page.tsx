import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "./components/BrandLogo";

export const metadata: Metadata = {
  title: "Daily S&P 500 Decision Brief",
  description:
    "Turn verified S&P 500 market context, event risk and structure into bullish, bearish and stand-aside plans before the US session.",
  alternates: { canonical: "/" },
};

const questions = [
  ["01", "Can the data be trusted?", "Provider status, timestamps and missing evidence stay visible before any conclusion."],
  ["02", "What defines the session?", "Regime, structure, catalysts and active conflicts are reduced to the facts that matter."],
  ["03", "What confirms each path?", "Bullish and bearish scenarios state what must happen before the idea becomes actionable."],
  ["04", "When should I stay out?", "No-trade conditions and invalidation receive the same prominence as opportunity."],
] as const;

const method = [
  ["Trust", "Verified inputs first", "Live, delayed and unavailable states are labelled. Missing data never becomes a fabricated level or signal."],
  ["Prepare", "Three conditional paths", "Review the bullish path, bearish path and stand-aside case before volatility forces a decision."],
  ["Review", "A process you can inspect", "Save the pre-session brief, record the outcome and evaluate the quality of the process over time."],
] as const;

const membership = [
  "Daily S&P 500 Session Brief",
  "Bullish, bearish and stand-aside paths",
  "Confirmation and invalidation",
  "Verified evidence and source status",
  "Brief archive and trading journal",
  "Account and billing controls",
] as const;

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="resetHome">
      <a className="resetSkip" href="#main-content">Skip to content</a>

      <header className="resetNav">
        <BrandLogo className="resetBrand" />
        <nav aria-label="Main navigation">
          <a href="#method">How it works</a>
          <a href="#membership">Membership</a>
          <Link href="/methodology">Methodology</Link>
        </nav>
        <div className="resetNavActions">
          <Link href="/login">Sign in</Link>
          <Link className="resetButton resetButtonSmall" href="/login">
            See today&apos;s framework <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <div id="main-content">
        <section className="resetHero" aria-labelledby="reset-hero-title">
          <div className="resetHeroCopy">
            <p className="resetEyebrow"><span /> Daily S&amp;P 500 decision brief</p>
            <h1 id="reset-hero-title">Know your conditions <em>before the market opens.</em></h1>
            <p className="resetLead">
              NASH AI Markets turns verified market context, event risk and structure
              into bullish, bearish and stand-aside plans—with confirmation and
              invalidation clear before the US session.
            </p>
            <div className="resetHeroActions">
              <Link className="resetButton" href="/login">See today&apos;s framework <span aria-hidden="true">↗</span></Link>
              <a className="resetTextLink" href="#method">How it works</a>
            </div>
            <ul className="resetPrinciples" aria-label="Product principles">
              <li>Verified inputs</li>
              <li>Conditional paths</li>
              <li>Risk before action</li>
            </ul>
          </div>

          <article className="resetBrief" aria-label="Illustrative daily decision brief">
            <header className="resetBriefHeader">
              <div>
                <span>Illustrative framework</span>
                <h2>Today&apos;s decision brief</h2>
              </div>
              <span className="resetTrustState"><i /> Evidence check</span>
            </header>

            <section className="resetPosture">
              <span>Session posture</span>
              <strong>Wait for confirmation</strong>
              <p>No directional path becomes active until price and supporting evidence agree.</p>
            </section>

            <div className="resetPaths">
              <section>
                <span>Bullish path</span>
                <strong>Acceptance first</strong>
                <p>Require a verified hold above the decision zone with supporting context.</p>
              </section>
              <section>
                <span>Bearish path</span>
                <strong>Rejection first</strong>
                <p>Require a verified loss of structure and failed recovery before acting.</p>
              </section>
              <section>
                <span>Stand aside</span>
                <strong>Conflict remains</strong>
                <p>Protect capital when data, catalysts or market structure do not agree.</p>
              </section>
            </div>

            <footer>
              <span>Illustrative only · NO LIVE MARKET VALUES</span>
              <strong>Scenarios, not predictions</strong>
            </footer>
          </article>
        </section>

        <section className="resetQuestionBand" aria-label="Questions answered by the daily brief">
          {questions.map(([number, title, detail]) => (
            <article key={number}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </section>

        <section className="resetMethod" id="method" aria-labelledby="reset-method-title">
          <header>
            <p className="resetEyebrow">One repeatable daily process</p>
            <h2 id="reset-method-title">Less noise.<br /><em>Better preparation.</em></h2>
            <p>
              Your charts and broker already show prices. NASH AI Markets is the
              decision layer between raw information and action.
            </p>
          </header>
          <div className="resetMethodSteps">
            {method.map(([label, title, detail], index) => (
              <article key={label}>
                <span>0{index + 1} / {label}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="resetProof" aria-labelledby="reset-proof-title">
          <div>
            <p className="resetEyebrow">Built for restraint</p>
            <h2 id="reset-proof-title">The answer can be <em>do nothing.</em></h2>
          </div>
          <div>
            <p>
              Most tools compete to produce another signal. This one is designed to
              withhold a conclusion when evidence is stale, incomplete or conflicted.
            </p>
            <dl>
              <div><dt>Unavailable evidence</dt><dd>No invented output</dd></div>
              <div><dt>Conflicting conditions</dt><dd>Stand aside remains valid</dd></div>
              <div><dt>Changing conditions</dt><dd>Invalidation stays visible</dd></div>
            </dl>
          </div>
        </section>

        <section className="resetMembership" id="membership" aria-labelledby="reset-membership-title">
          <div className="resetMembershipCopy">
            <p className="resetEyebrow">One focused membership</p>
            <h2 id="reset-membership-title">Everything required for the daily decision.</h2>
            <p>
              One clear workspace for preparation, evidence and review. Existing
              memberships remain supported while the simplified offer is introduced.
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
        <p>Prepare the conditions. Respect the invalidation. Protect the decision.</p>
        <nav aria-label="Legal and support">
          <Link href="/risk-disclaimer">Risk</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}
