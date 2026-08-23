import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { DisciplineCheck } from "./_components/DisciplineCheck.tsx";
import "./launch-preview.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private launch centre",
  description: "Private, example-only launch presentation for NASH AI Markets Project Bullseye.",
  robots: { index: false, follow: false },
};

const productMoments = [
  {
    index: "01",
    eyebrow: "ORIENT",
    title: "See the session in 30 seconds.",
    copy: "Bring posture, verified context, the next catalyst and the main risk into one calm starting point.",
  },
  {
    index: "02",
    eyebrow: "PREPARE",
    title: "Switch into Catalyst Event Mode.",
    copy: "Prepare, observe the release window and re-verify without turning a scheduled event into automatic permission.",
  },
  {
    index: "03",
    eyebrow: "UNDERSTAND",
    title: "Follow the evidence, not a black box.",
    copy: "The Evidence Map shows what supports, restricts or is unavailable before the existing decision presentation is shown.",
  },
  {
    index: "04",
    eyebrow: "REVIEW",
    title: "Build a five-session discipline habit.",
    copy: "Use the free Discipline Check and device-local challenge to make preparation visible without pretending either predicts the market.",
  },
] as const;

const launchPrinciples = [
  "No fake live data",
  "No invented certainty",
  "No profit or win-rate claims",
  "No account, provider or billing writes",
] as const;

export default function LaunchPreviewPage() {
  // This campaign lab is deliberately private. It must never become a public
  // production route by accident; publication requires a separate compliance decision.
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <main className="viralLaunch" data-launch-preview="example-only">
      <aside className="vlPreviewBanner" role="status">
        <strong>PRIVATE LAUNCH LAB</strong>
        <span>Presentation and discipline-check content only · no live market data · no customer writes</span>
      </aside>

      <header className="vlNav">
        <BrandLogo href="/launch-preview" />
        <nav aria-label="Launch centre navigation">
          <a href="#story">Founder story</a>
          <a href="#experience">Experience</a>
          <a href="#discipline-check">Free check</a>
          <Link href="/marketing-preview?state=constructive">Private demo</Link>
        </nav>
      </header>

      <section className="vlHero" aria-labelledby="vl-hero-title">
        <div className="vlHeroCopy">
          <span className="vlEyebrow">NASH AI MARKETS · PROJECT BULLSEYE</span>
          <h1 id="vl-hero-title">The market has a <em>WAIT</em> button.</h1>
          <p>
            Bullseye organises what is verified, what is missing and what needs confirmation—so the S&amp;P 500 routine becomes clearer without pretending the market is certain.
          </p>
          <div className="vlHeroActions">
            <a className="vlPrimaryAction" href="#discipline-check">Run the free discipline check</a>
            <Link className="vlSecondaryAction" href="/marketing-preview?state=constructive">Explore the example workspace</Link>
          </div>
          <small>Educational decision-support presentation only. Example screens are not live trading instructions.</small>
        </div>

        <div className="vlHeroVisual" aria-label="Example Bullseye launch sequence">
          <div className="vlTarget" aria-hidden="true">
            <i /><i /><i />
            <Image src="/brand/logo-mark.svg" width={86} height={86} alt="" />
          </div>
          <span>EXAMPLE-ONLY DECISION STATE</span>
          <strong>WAIT FOR VERIFIED CONTEXT</strong>
          <p>Evidence incomplete · permission remains closed</p>
          <div className="vlSequence" aria-hidden="true">
            <b>ORIENT</b><i /><b>VERIFY</b><i /><b>DECIDE</b>
          </div>
        </div>
      </section>

      <section className="vlFounder" id="story" aria-labelledby="vl-story-title">
        <div>
          <span className="vlEyebrow">THE HUMAN STORY</span>
          <h2 id="vl-story-title">Built after work, not inside a hedge fund.</h2>
        </div>
        <blockquote>
          “I&apos;m a roofer and a trader—not somebody who grew up building software. I got fed up opening endless charts, indicators and news pages and still not having a clear session plan. So I started building the product I wanted to use.”
          <footer>Chris Nash · Founder, NASH AI Markets</footer>
        </blockquote>
      </section>

      <section className="vlExperience" id="experience" aria-labelledby="vl-experience-title">
        <header>
          <div>
            <span className="vlEyebrow">THE BULLSEYE WORKFLOW</span>
            <h2 id="vl-experience-title">One session. Four deliberate moments.</h2>
          </div>
          <p>The product story is preparation, transparency and process—not another promise of easy trades.</p>
        </header>
        <div className="vlMomentGrid">
          {productMoments.map((moment) => (
            <article key={moment.index}>
              <span>{moment.index} · {moment.eyebrow}</span>
              <h3>{moment.title}</h3>
              <p>{moment.copy}</p>
            </article>
          ))}
        </div>
        <Link className="vlExperienceLink" href="/marketing-preview?state=constructive">
          Open the genuine example-only Bullseye experience →
        </Link>
      </section>

      <DisciplineCheck />

      <section className="vlTrust" aria-labelledby="vl-trust-title">
        <div>
          <span className="vlEyebrow">TRUST IS THE CAMPAIGN</span>
          <h2 id="vl-trust-title">Built to be shared without selling a fantasy.</h2>
          <p>Every public asset must preserve the visible data limitation, balanced risk language and the difference between process support and personalised advice.</p>
        </div>
        <ul>
          {launchPrinciples.map((principle) => <li key={principle}>{principle}</li>)}
        </ul>
      </section>

      <section className="vlFinalCta" aria-labelledby="vl-final-title">
        <span className="vlEyebrow">FIRST COHORT · PRELAUNCH</span>
        <h2 id="vl-final-title">See the session. Know the risk. Make the next decision clearer.</h2>
        <p>The waiting-list connection remains deliberately separate until the public launch, data-rights and qualified-promotion gates are cleared.</p>
        <div>
          <Link href="/marketing-preview?state=constructive">Explore the private demo</Link>
          <span aria-disabled="true">Public launch connection reserved</span>
        </div>
      </section>

      <footer className="vlFooter">
        <BrandLogo compact href="/launch-preview" />
        <p>Private example-only campaign lab. Trading and investing involve risk. NASH AI Markets provides educational market analysis and decision-support tools, not personalised financial advice.</p>
        <Link href="/">Return home</Link>
      </footer>
    </main>
  );
}
