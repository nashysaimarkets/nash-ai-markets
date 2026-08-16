import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { WaitlistForm } from "./WaitlistForm.tsx";

export const metadata: Metadata = {
  title: "Launch Waiting List",
  description: "Join the NASH AI Markets launch list for a calmer, evidence-first S&P 500 session workflow.",
  alternates: {
    canonical: "/waitlist",
  },
  openGraph: {
    title: "Join the NASH AI Markets Launch Waiting List",
    description: "A calmer S&P 500 session workflow: orient, plan, manage risk and review the process.",
    url: "/waitlist",
    type: "website",
    images: [{
      url: "/waitlist-og.png",
      width: 1200,
      height: 630,
      alt: "NASH AI Markets Bullseye — prepare the session, see the risk and know when to stand aside",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join the NASH AI Markets Launch Waiting List",
    description: "A calmer S&P 500 session workflow: orient, plan, manage risk and review the process.",
    images: ["/waitlist-og.png"],
  },
};

const outcomes = [
  {
    number: "01",
    title: "Orient faster",
    detail: "Bring official macro context, scheduled catalysts and the session backdrop into one repeatable morning routine.",
  },
  {
    number: "02",
    title: "See risk clearly",
    detail: "Make incomplete evidence, invalidation conditions and the decision to stand aside visible before impulse takes over.",
  },
  {
    number: "03",
    title: "Review the process",
    detail: "Keep the plan separate from the outcome so discipline can improve without pretending every session was predictable.",
  },
] as const;

const productWorkflow = [
  { label: "Morning Brief", detail: "Start with context, catalysts and known uncertainty." },
  { label: "Trading Desk", detail: "Organise evidence, conditions and personal levels." },
  { label: "Decision controls", detail: "Fail closed when required inputs are unavailable or stale." },
  { label: "Journal & review", detail: "Compare the session plan with the verified outcome." },
] as const;

const availableNow = [
  "Official macro and economic-event context",
  "Personal support and resistance planner",
  "Preparation checklists and no-trade conditions",
  "Journal, review and process-learning tools",
] as const;

const conditionalData = [
  "Customer-facing ES and VIX intraday values",
  "Intraday candlesticks, VWAP and moving averages",
  "Derived directional guidance that depends on those inputs",
] as const;

const questions = [
  {
    question: "Is Bullseye a signal service?",
    answer: "No. Bullseye is an educational market-analysis and decision-support workflow. It does not execute trades, hold customer funds or promise profitable outcomes.",
  },
  {
    question: "Will every market panel be live at launch?",
    answer: "No claim is made until the relevant feed and customer-display rights are verified. Licensed intraday features remain clearly unavailable or delayed whenever that evidence is missing.",
  },
  {
    question: "Does joining the list charge me?",
    answer: "No. Joining records launch interest only. No card is requested, no membership is created and no automatic subscription begins.",
  },
  {
    question: "Can I leave the launch list?",
    answer: "Yes. You can opt out of launch communication at any time. Privacy and contact routes remain available from every public page.",
  },
] as const;

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const query = await searchParams;
  const foundingPro = query.plan === "founding-pro";
  const heroTitle = foundingPro
    ? "Reserve your interest in Founding Pro."
    : "Prepare the session. See the risk. Know when to stand aside.";
  const heroLead = foundingPro
    ? "Register interest in the £12/month Founding Pro launch offer. The offer is intended for the first 100 verified successful subscribers once checkout opens; joining this list is not a purchase and does not guarantee a place."
    : "Join the launch waiting list for a calmer S&P 500 routine built around verified context, clear conditions and disciplined review — without fake urgency, guaranteed places, or automatic billing.";

  return <main className={`launchPage launchWaitlist${foundingPro ? " isFounding" : ""}`}>
    <header className="launchPageNav">
      <BrandLogo />
      <nav aria-label="Launch navigation">
        <a href="#inside">Inside Bullseye</a>
        <a href="#data-status">Data status</a>
        <Link href="/login">Member login</Link>
      </nav>
    </header>

    <section className="launchHero launchWaitlistHero" aria-labelledby="launch-title">
      <div className="launchHeroCopy">
        <span>NASH AI MARKETS · {foundingPro ? "FOUNDING PRO" : "SESSION OPERATING SYSTEM"}</span>
        <h1 id="launch-title">{heroTitle}</h1>
        <p className="launchLead">{heroLead}</p>
        <ul aria-label="Bullseye launch principles">
          <li>Official macro and event context</li>
          <li>Licensed intraday status when available</li>
          <li>Fail-closed decision controls</li>
        </ul>
        <div className="launchHeroActions">
          <a className="launchButtonPrimary" href="#join">{foundingPro ? "Register Founding Pro interest" : "Join the launch list"}</a>
          <a className="launchButtonSecondary" href="#film">Watch the launch film</a>
        </div>
        <p className="launchMicroTrust">No card details · No automatic billing · No guaranteed invitation</p>
      </div>

      <aside id="join" className="launchFormCard" aria-labelledby="launch-form-title">
        <span>{foundingPro ? "FOUNDING PRO INTEREST" : "REQUEST LAUNCH UPDATES"}</span>
        <h2 id="launch-form-title">{foundingPro ? "Register launch-offer interest" : "Get the launch briefing"}</h2>
        <p>We will use your email only for relevant NASH AI Markets launch communication and account follow-up. No guaranteed invitation and no automatic billing.</p>
        <WaitlistForm foundingPro={foundingPro} />
        <footer>Educational market commentary only. Joining the list is not financial advice or a subscription purchase.</footer>
      </aside>
    </section>

    <section id="film" className="launchFilmSection" aria-labelledby="launch-film-title">
      <div className="launchFilmIntro">
        <header>
          <span>BULLSEYE LAUNCH FILM · 25 SECONDS</span>
          <h2 id="launch-film-title">See the workflow in motion.</h2>
        </header>
        <p id="launch-film-note">A cinematic look at the genuine Bullseye experience using clearly labelled example-only screens. The first-party 720p film does not autoplay; full playback begins only when you choose to play it.</p>
      </div>
      <div className="launchFilmFrame">
        <div className="launchFilmTopline">
          <span>EXAMPLE PRODUCT VISUAL · NOT LIVE MARKET DATA</span>
          <small>CLICK TO PLAY · NO THIRD-PARTY TRACKING</small>
        </div>
        <video
          controls
          playsInline
          preload="metadata"
          poster="/launch/video/bullseye-v16-reveal-poster.webp"
          aria-label="Bullseye 25-second launch film"
          aria-describedby="launch-film-note launch-film-transcript"
        >
          <source src="/launch/video/bullseye-v16-reveal-25s-web.mp4" type="video/mp4" />
          Your browser does not support embedded video. <a href="/launch/video/bullseye-v16-reveal-25s-web.mp4">Open the launch film</a> instead.
        </video>
      </div>
      <details id="launch-film-transcript" className="launchFilmTranscript">
        <summary>Read the on-screen-caption transcript <span aria-hidden="true">+</span></summary>
        <p>Too many charts. Too many opinions. Still no clear plan? Bullseye brings context, catalysts, risk and review into one S&amp;P 500 session workflow. When the evidence is incomplete, the decision stays closed. Prepare the session. See the risk. Know when to stand aside. Join the launch waiting list.</p>
      </details>
    </section>

    <section className="launchTrustRail" aria-label="Product trust commitments">
      <article><span>DATA</span><strong>Truth before theatre</strong><small>Unavailable inputs stay unavailable.</small></article>
      <article><span>RISK</span><strong>Standing aside counts</strong><small>No-trade conditions remain visible.</small></article>
      <article><span>PROCESS</span><strong>Plan before outcome</strong><small>Review discipline, not hindsight.</small></article>
      <article><span>PRIVACY</span><strong>No advertising trackers</strong><small>First-party launch interest only.</small></article>
    </section>

    <section className="launchSection launchOutcomeSection" aria-labelledby="outcomes-title">
      <header className="launchSectionHeader">
        <span>WHY BULLSEYE</span>
        <h2 id="outcomes-title">Less noise. A better decision process.</h2>
        <p>The product is designed around the complete session loop—not another wall of indicators.</p>
      </header>
      <div className="launchOutcomeGrid">
        {outcomes.map((outcome) => <article key={outcome.number}>
          <span>{outcome.number}</span>
          <h3>{outcome.title}</h3>
          <p>{outcome.detail}</p>
        </article>)}
      </div>
    </section>

    <section id="inside" className="launchSection launchInsideSection" aria-labelledby="inside-title">
      <header className="launchSectionHeader">
        <span>INSIDE THE WORKFLOW</span>
        <h2 id="inside-title">From orientation to review.</h2>
        <p>One calm route through the session, with every market-data boundary stated plainly.</p>
      </header>
      <div className="launchProductStage">
        <div className="launchProductMap" role="group" aria-label="Example-only Bullseye product workflow">
          <div className="launchProductMapTopline">
            <span>EXAMPLE-ONLY PRODUCT MAP</span>
            <small>NO LIVE MARKET DATA</small>
          </div>
          <div className="launchProductMapBody">
            <div className="launchProductMapNav" aria-hidden="true">
              <b>BULLSEYE</b>
              <span className="isActive">Morning Brief</span>
              <span>Trading Desk</span>
              <span>My Levels</span>
              <span>Journal</span>
            </div>
            <div className="launchProductCanvas">
              <div className="launchProductHeadline">
                <span>SESSION READINESS</span>
                <strong>Evidence first</strong>
                <small>Decision permission stays closed when required inputs are unavailable.</small>
              </div>
              <div className="launchProductSignals">
                <article><span>CONTEXT</span><strong>Orient</strong><i className="isReady" aria-hidden="true" /></article>
                <article><span>CONDITIONS</span><strong>Plan</strong><i className="isWaiting" aria-hidden="true" /></article>
                <article><span>OUTCOME</span><strong>Review</strong><i aria-hidden="true" /></article>
              </div>
              <div className="launchEvidenceLines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            </div>
          </div>
        </div>
        <ol className="launchWorkflowList">
          {productWorkflow.map((step, index) => <li key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{step.label}</strong><small>{step.detail}</small></div>
          </li>)}
        </ol>
      </div>
    </section>

    <section id="data-status" className="launchSection launchDataSection" aria-labelledby="data-title">
      <header className="launchSectionHeader">
        <span>TRANSPARENT DATA STATUS</span>
        <h2 id="data-title">Useful now. Honest about what is conditional.</h2>
        <p>Bullseye will never fill a live-data gap with invented figures. The workflow remains useful while licensed ES and VIX display rights are being resolved.</p>
      </header>
      <div className="launchDataGrid">
        <article className="isAvailable">
          <div><span>AVAILABLE WITHOUT A PREMIUM FEED</span><strong>Preparation & process</strong></div>
          <ul>{availableNow.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="isConditional">
          <div><span>LICENSE REQUIRED</span><strong>Intraday market layer</strong></div>
          <ul>{conditionalData.map((item) => <li key={item}>{item}</li>)}</ul>
          <small>These features remain unavailable or clearly delayed until a verified licence permits customer display and derived use.</small>
        </article>
      </div>
    </section>

    <section className="launchSection launchAudienceSection" aria-labelledby="audience-title">
      <header className="launchSectionHeader">
        <span>BUILT FOR DISCIPLINE</span>
        <h2 id="audience-title">Know whether it fits you.</h2>
      </header>
      <div className="launchAudienceGrid">
        <article>
          <span>IT MAY FIT IF YOU WANT TO…</span>
          <ul><li>prepare before the US session opens;</li><li>separate evidence from impulse;</li><li>record conditions and invalidation levels;</li><li>review the quality of the process afterwards.</li></ul>
        </article>
        <article className="isNotFor">
          <span>IT IS NOT BUILT TO…</span>
          <ul><li>promise winning trades or guaranteed returns;</li><li>copy trades or execute orders automatically;</li><li>replace personal financial advice;</li><li>pretend unavailable market data is live.</li></ul>
        </article>
      </div>
    </section>

    <section className="launchSection launchFaqSection" aria-labelledby="faq-title">
      <header className="launchSectionHeader">
        <span>STRAIGHT ANSWERS</span>
        <h2 id="faq-title">Before you join the list.</h2>
      </header>
      <div className="launchFaqList">
        {questions.map((item) => <details key={item.question}>
          <summary>{item.question}<span aria-hidden="true">+</span></summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </section>

    <section className="launchFinalCta" aria-labelledby="launch-final-title">
      <span>NASH AI MARKETS · PROJECT BULLSEYE</span>
      <h2 id="launch-final-title">Make preparation the advantage.</h2>
      <p>Join for truthful launch updates. No card, no false countdown and no automatic subscription.</p>
      <a className="launchButtonPrimary" href="#join">{foundingPro ? "Register Founding Pro interest" : "Join the launch list"}</a>
    </section>

    <footer className="launchFooter launchWaitlistFooter">
      <p>Trading and investing involve risk. NASH AI Markets provides educational market analysis and decision-support tools, not personalised financial advice. Example screens may contain illustrative or delayed information and must not be treated as live trading instructions.</p>
      <nav aria-label="Legal and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav>
      <span>© 2026 NASH AI Markets</span>
    </footer>
  </main>;
}
