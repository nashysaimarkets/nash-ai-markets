import type { Metadata } from "next";
import Link from "next/link";
import "../pocket-founding.css";
import "./welcome.css";

export const metadata: Metadata = {
  title: "Welcome to Pocket Bullseye",
  robots: { index: false, follow: false },
};

const steps = [
  {
    number: "01",
    icon: "▣",
    title: "SAVE POCKET",
    copy: "Keep Pocket one tap away on your phone or desktop.",
    details: [
      "iPhone: open in Safari → Share → Add to Home Screen → Add.",
      "Android: open in Chrome → menu → Add to Home screen or Install app.",
      "Desktop: use the install icon in the address bar, or bookmark Pocket.",
    ],
  },
  {
    number: "02",
    icon: "◎",
    title: "UPLOAD YOUR FIRST CHART",
    copy: "Give Bullseye a clear, readable source image.",
    details: [
      "Tap LOAD CHART and choose a screenshot from your camera roll.",
      "Include the instrument, timeframe, candles and full price scale.",
      "Remove your name, account number, balance and notifications first.",
      "Choose LONG, SHORT or JUST ANALYSE, confirm Privacy Shield, then challenge the setup.",
    ],
  },
  {
    number: "03",
    icon: "◇",
    title: "HELP SHAPE POCKET",
    copy: "Your problems and ideas go directly into the build process.",
    details: [
      "Tap the green FEEDBACK button at the bottom-right inside Pocket.",
      "Choose REPORT A PROBLEM or SHARE AN IDEA and describe what happened.",
      "Please never include passwords, payment-card details or trading-account information.",
    ],
  },
] as const;

export default function PocketFoundingWelcome() {
  return (
    <main className="pfLaunch pfWelcome">
      <section className="pfWelcomeHero">
        <div className="pfWelcomeTarget" aria-hidden="true">🎯</div>
        <span>PAYMENT CONFIRMATION RECEIVED</span>
        <h1>Welcome to<br /><em>Pocket Bullseye.</em></h1>
        <p className="pfWelcomeLead">Stripe is securely confirming your subscription and Founding 650 position. Use the same email address to access Pocket.</p>

        <div className="pfWelcomeStatus"><i aria-hidden="true" /><div><strong>WHAT HAPPENS NOW</strong><p>Check for your Stripe receipt, then open Pocket. If access is still updating, wait briefly and retry—do not purchase twice.</p></div></div>

        <section className="pfWelcomeSteps" aria-label="Pocket Bullseye quick-start guide">
          <header><span>YOUR THREE-STEP QUICK START</span><h2>Ready for your first chart.</h2></header>
          {steps.map((step) => (
            <article key={step.number}>
              <b>{step.number}</b>
              <div className="pfWelcomeStepIcon" aria-hidden="true">{step.icon}</div>
              <div><strong>{step.title}</strong><p>{step.copy}</p><ul>{step.details.map((detail) => <li key={detail}>{detail}</li>)}</ul></div>
            </article>
          ))}
        </section>

        <div className="pfWelcomeActions">
          <Link href="/pocket#pocket-chart-upload">OPEN POCKET &amp; LOAD A CHART <span aria-hidden="true">→</span></Link>
          <a href="mailto:hello@nashaimarkets.com?subject=Pocket%20Bullseye%20founder%20feedback">EMAIL SUPPORT OR FEEDBACK <span aria-hidden="true">↗</span></a>
        </div>

        <small>Your £4.99 price lock remains active only while the founding subscription stays continuously active.</small>
        <p className="pfWelcomeLegal">Educational chart analysis only. Pocket Bullseye does not provide personalised financial advice, execute trades or guarantee outcomes.</p>
      </section>
    </main>
  );
}
