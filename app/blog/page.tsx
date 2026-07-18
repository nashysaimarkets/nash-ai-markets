import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo";

export const metadata: Metadata = {
  title: "Market Intelligence Journal",
  description: "Practical notes on verified market context, scenario planning and disciplined risk decisions.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Market Intelligence Journal | NASH AI Markets",
    description: "Practical notes on verified market context, scenario planning and disciplined risk decisions.",
    url: "/blog",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NASH AI Markets — Pre-Market Mission Control",
      },
    ],
  },
};

const notes = [
  {
    number: "01",
    label: "DATA INTEGRITY",
    title: "Why unavailable is a valid market state",
    copy: "A disciplined workflow distinguishes verified, delayed and unavailable inputs. When freshness or provenance cannot be established, withholding a directional conclusion protects the quality of every decision that follows.",
  },
  {
    number: "02",
    label: "SCENARIO DESIGN",
    title: "Prepare conditions, not predictions",
    copy: "Bullish, bearish and stand-aside cases become useful when each has observable confirmation and invalidation. The objective is not certainty; it is a reviewable response to changing evidence.",
  },
  {
    number: "03",
    label: "RISK PROCESS",
    title: "Treat no-trade as an active decision",
    copy: "Conflicting drivers, elevated event risk or incomplete data can make waiting the highest-quality action. A professional process records why participation is withheld and what evidence would justify reassessment.",
  },
] as const;

export default function BlogPage() {
  return <main className="journalPage">
    <header className="journalNav"><BrandLogo /><nav aria-label="Journal navigation"><Link href="/">Overview</Link><Link href="/pricing">Membership</Link></nav></header>
    <section className="journalHero"><span>MARKET INTELLIGENCE JOURNAL</span><h1>Better decisions begin<br />before the market moves.</h1><p>Evergreen field notes on verified context, conditional thinking and risk-aware preparation. Educational information only—never live signals or personalised advice.</p></section>
    <section className="journalGrid" aria-label="Journal notes">{notes.map((note) => <article key={note.number}><header><span>{note.number}</span><b>{note.label}</b></header><h2>{note.title}</h2><p>{note.copy}</p><footer>PROCESS NOTE · NO LIVE MARKET DATA</footer></article>)}</section>
    <section className="journalMethod"><div><span>THE BULLSEYE STANDARD</span><h2>Verify. Assess. Plan. Decide.</h2></div><p>Every note follows the same standard as the platform: separate facts from analysis, make uncertainty visible and keep risk constraints intact.</p><Link href="/about">Read about our approach <span>↗</span></Link></section>
    <footer className="journalFooter"><span>© 2026 NASH AI Markets</span><nav><Link href="/contact">Contact</Link><Link href="/risk-disclaimer">Risk</Link><Link href="/privacy">Privacy</Link></nav></footer>
  </main>;
}
