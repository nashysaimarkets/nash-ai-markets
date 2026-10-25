import { POCKET_PRODUCT } from "../../../lib/product-brand";
import type { Metadata } from "next";
import Link from "next/link";
import "../pocket-founding.css";
import "./welcome.css";

export const metadata: Metadata = {
  title: `Welcome to ${POCKET_PRODUCT.displayName}`,
  robots: { index: false, follow: false },
};

const steps = [
  {
    number: "01",
    icon: "▣",
    title: `SAVE ${POCKET_PRODUCT.shortName}`,
    copy: `Keep ${POCKET_PRODUCT.shortName} one tap away on your phone or desktop.`,
    details: [
      "iPhone: open in Safari → Share → Add to Home Screen → Add.",
      "Android: open in Chrome → menu → Add to Home screen or Install app.",
      `Desktop: use the install icon in the address bar, or bookmark ${POCKET_PRODUCT.shortName}.`,
    ],
  },
  {
    number: "02",
    icon: "◎",
    title: "UPLOAD YOUR FIRST CHART",
    copy: "Choose a clear, readable source image.",
    details: [
      "Tap Add a source chart and choose a screenshot from your camera roll.",
      "Include the instrument, timeframe, candles and full price scale.",
      "Remove your name, account number, balance and notifications first.",
      "Choose LONG, SHORT or NO BIAS, complete the privacy and chart-fact checks, then tap ANALYSE CHART.",
    ],
  },
  {
    number: "03",
    icon: "◇",
    title: `HELP SHAPE ${POCKET_PRODUCT.shortName}`,
    copy: "Your problems and ideas go directly into the build process.",
    details: [
      "Use EMAIL SUPPORT OR FEEDBACK below if you need help.",
      "Describe the problem or suggestion and include the app version if known.",
      "Please never include passwords, payment-card details or trading-account information.",
    ],
  },
] as const;

export default function PocketFoundingWelcome() {
  return (
    <main className="pfLaunch pfWelcome">
      <section className="pfWelcomeHero">
        <div className="pfWelcomeTarget" aria-hidden="true">{POCKET_PRODUCT.shortName}</div>
        <span>CHECK YOUR SUBSCRIPTION</span>
        <h1>Welcome to<br /><em>{POCKET_PRODUCT.name}.</em></h1>
        <p className="pfWelcomeLead">Open {POCKET_PRODUCT.shortName} with the verified account you used at checkout to check your subscription. A visit to this page does not confirm payment or scanner access.</p>

        <div className="pfWelcomeStatus"><i aria-hidden="true" /><div><strong>WHAT HAPPENS NOW</strong><p>Check for your Stripe receipt, then open {POCKET_PRODUCT.shortName}. If access is still updating, wait briefly and retry—do not purchase twice.</p></div></div>

        <section className="pfWelcomeSteps" aria-label={`${POCKET_PRODUCT.shortName} quick-start guide`}>
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
          <Link href="/pocket#pn-intake">OPEN {POCKET_PRODUCT.shortName} &amp; ADD A CHART <span aria-hidden="true">→</span></Link>
          <a href="mailto:hello@nashaimarkets.com?subject=NTP%20founder%20feedback">EMAIL SUPPORT OR FEEDBACK <span aria-hidden="true">↗</span></a>
        </div>

        <small>Your £4.99 price lock remains active only while the founding subscription stays continuously active.</small>
        <p className="pfWelcomeLegal">Educational chart analysis only. {POCKET_PRODUCT.name} does not provide personalised financial advice, execute trades or guarantee outcomes.</p>
      </section>
    </main>
  );
}
