import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";
import { AppStoreLink, IntroductionVisit, SampleLink, UsageControl } from "../pocket/GrowthControls";
import "../pocket/pocket-growth.css";
import SamplePreview from "./SamplePreview";

const productUrl = "https://pocket.nashaimarkets.com/pocket-bullseye";
const appStoreUrl = "https://apps.apple.com/app/id6806004581";
const description = "Upload a trading-chart screenshot for an AI second opinion on support, resistance, market structure, scenarios and risk. Try one complete analysis free on iPhone or iPad.";

export const metadata: Metadata = {
  title: { absolute: "Pocket Bullseye — AI Chart Analysis for iPhone & iPad" },
  description,
  applicationName: "Pocket Bullseye",
  keywords: ["Pocket Bullseye", "AI chart analysis", "support and resistance scanner", "chart screenshot analysis", "iPhone trading education"],
  alternates: { canonical: productUrl },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Pocket Bullseye — A second opinion on your trading chart",
    description,
    url: productUrl,
    siteName: "Pocket Bullseye",
    type: "website",
    locale: "en_GB",
    images: [],
  },
  twitter: { card: "summary", title: "Pocket Bullseye — AI Chart Analysis", description, images: [] },
};

const evidence = [
  ["01", "What am I missing?", "Compare the direction and visible levels across your screenshots. A rising short timeframe can hide a falling wider view."],
  ["02", "What would change my mind?", "Review the bullish case, bearish case and conditions that would weaken the setup. Check the evidence against your chart."],
  ["03", "Is there a reason to wait?", "Read the setup grade, risk flags and missing confirmation before deciding what to do next."],
] as const;

export default function PocketBullseyeIntroduction() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pocket Bullseye: AI Charts",
    applicationCategory: "FinanceApplication",
    operatingSystem: "iOS, iPadOS",
    url: productUrl,
    installUrl: appStoreUrl,
    description,
    creator: { "@type": "Organization", name: "NASH AI Markets", url: "https://nashaimarkets.com" },
  };

  return (
    <div className={styles.page}>
      <IntroductionVisit />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
      <a className={styles.skip} href="#pocket-introduction">Skip to content</a>
      <header className={styles.header}>
        <a className={styles.brand} href={productUrl} aria-label="Pocket Bullseye home">
          <Image src="/pocket-marketing/app-icon.png" width={48} height={48} alt="" unoptimized />
          <span>Pocket Bullseye<small>By NASH AI Markets</small></span>
        </a>
        <a className={styles.textLink} href="#pocket-price">Free analysis + pricing</a>
      </header>

      <main id="pocket-introduction">
        <section className={styles.hero} aria-labelledby="pocket-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI CHART ANALYSIS · IPHONE & IPAD</p>
            <h1 id="pocket-title">Check the setup.<br /><span>Before you trade.</span></h1>
            <p className={styles.lead}>Upload your chart. See the key levels, the opposing case and the reasons to wait.</p>
            <p className={styles.supporting}>Pocket Bullseye gives you a structured second opinion on the screenshot you already use. Add other timeframes to see where the views disagree.</p>
            <AppStoreLink className={styles.button}>Try one analysis free on iPhone <span aria-hidden="true">↗</span></AppStoreLink>
            <p className={styles.offer}>Also on iPad. Then £4.99/month in the UK if you subscribe.<br />Regional prices vary. Subscription managed through Apple.</p>
            <p className={styles.sampleLink}><SampleLink>See a full example first →</SampleLink><small>No upload, account or subscription needed for the example.</small></p>
          </div>
          <div className={styles.heroVisual}>
            <SamplePreview />
          </div>
        </section>

        <section className={styles.evidence} aria-labelledby="evidence-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>THREE QUESTIONS BEFORE THE TRADE</p>
            <h2 id="evidence-heading">Challenge the idea you want to believe.</h2>
          </div>
          <div className={styles.evidenceGrid}>
            {evidence.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className={styles.priceSection} id="pocket-price" aria-labelledby="price-heading">
          <div><p className={styles.eyebrow}>START WITH YOUR OWN CHART</p><h2 id="price-heading">One complete analysis free.</h2><p>See the result on a setup you understand. Decide whether continued analysis is worth paying for.</p></div>
          <div className={styles.priceOffer}><p><strong>£4.99</strong><span> / month · UK</span></p><ul><li>Continued chart analysis after your free result</li><li>Support, resistance and conditional scenarios</li><li>Up to five screenshots of the same instrument</li><li>Saved setups and review tools on your device</li></ul><AppStoreLink className={styles.button}>Get the iPhone &amp; iPad app ↗</AppStoreLink><small>Monthly subscription renews automatically. Manage or cancel in your Apple Account settings. Check your local App Store for the price.</small></div>
        </section>

        <section className={styles.workflow} aria-labelledby="workflow-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>FROM SCREENSHOT TO SECOND OPINION</p>
            <h2 id="workflow-heading">Start with the chart you already use.</h2>
          </div>
          <ol>
            <li><h3>Upload a clear screenshot</h3><p>Keep the instrument, timeframe, candles and price scale visible. Add up to four supporting screenshots of the same instrument when useful.</p></li>
            <li><h3>Review the analysis</h3><p>Read the visible chart structure, conditional scenarios and risk context. Check the findings against your original chart.</p></li>
            <li><h3>Decide what happens next</h3><p>Use the review to question your setup, refine your thinking or wait for clearer evidence.</p></li>
          </ol>
        </section>

        <section className={styles.questions} aria-labelledby="questions-heading">
          <h2 id="questions-heading">Before you start</h2>
          <details><summary>What is included for free?</summary><p>Download the app and complete one chart analysis free. Further analysis requires a monthly subscription. The UK App Store price is £4.99 per month; check your local App Store for regional pricing.</p></details>
          <details><summary>Can I use a screenshot from my broker or TradingView?</summary><p>Yes. Start with a clear chart screenshot showing the instrument, timeframe, candles and price scale. The app reads the picture; no broker connection is needed. If you add supporting screenshots, use the same instrument and take them together.</p></details>
          <details><summary>What if my chart cannot be read?</summary><p>Unclear screenshots and missing price scales can limit the result. Check any uncertainty messages and upload a clearer image. AI can misread a chart, so verify prices, levels and the timeframe before using the analysis.</p></details>
          <details><summary>How do I cancel or restore my subscription?</summary><p>Manage or cancel an Apple subscription in your Apple Account settings. Use Restore Purchases in the app with the Apple Account that made the purchase. For help, email <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.</p></details>
          <details><summary>Does Pocket Bullseye place trades?</summary><p>No. It reviews screenshots. It does not connect to a brokerage, execute trades or provide a live market-data feed.</p></details>
          <details><summary>Can I rely on it for a trading decision?</summary><p>Use it as educational support for your own review. Screenshot quality and the visible evidence limit the analysis, and AI can make mistakes. Verify the results independently. It is not personalised financial advice and does not guarantee trading outcomes.</p></details>
        </section>

        <nav className={styles.focusedLinks} aria-label="Explore Pocket Bullseye"><a href="/pocket-bullseye/indices">Index chart examples</a><a href="/pocket-bullseye/forex">Forex chart review</a><a href="/pocket-bullseye/review">Review a saved setup</a></nav>

        <section className={styles.lastCall} aria-label="Try Pocket Bullseye">
          <div><p className={styles.eyebrow}>TAKE A SECOND LOOK</p><h2>Your first complete analysis is free.</h2></div>
          <AppStoreLink className={styles.button}>View on the App Store <span aria-hidden="true">↗</span></AppStoreLink>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} NASH AI Markets · Pocket Bullseye</p>
        <nav aria-label="Product information"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:hello@nashaimarkets.com">Contact</a></nav>
        <UsageControl />
        <p className={styles.risk}>Educational chart analysis. Trading involves risk. You remain responsible for your decisions.</p>
      </footer>
      <aside className={styles.mobileAction} aria-label="Get Pocket Bullseye"><span>First analysis free<small>Then £4.99/month · UK</small></span><AppStoreLink>Get the app ↗</AppStoreLink></aside>
    </div>
  );
}
