import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy information for NASH AI Markets.",
};

export default function Privacy() {
  return (
    <main className="legal">
      <header><Link href="/">← NASH AI MARKETS</Link></header>
      <article>
        <span>LEGAL</span>
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: 22 August 2026</p>

        <h2>Who we are</h2>
        <p>
          NASH AI Markets provides educational market commentary. You can contact us at{" "}
          <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.
        </p>

        <h2>Information we collect</h2>
        <p>
          We process account email addresses, optional profile details, waiting-list requests, Founding Member onboarding preferences,
          membership and preview-access records, Founding
          100 programme position and price-lock status, authentication-session data, and support
          messages. Stripe processes payment details; Bullseye stores the customer, subscription,
          status and billing-period identifiers needed to grant access, but does not store card
          details.
        </p>

        <h2>How we use information</h2>
        <p>
          We use information to authenticate members, manage subscriptions and feature access,
          administer launch communications and onboarding review, prevent preview abuse, respond
          to enquiries, operate and secure the service, and meet legal obligations. We do not sell
          personal information.
        </p>

        <h2>Pocket Bullseye chart audits</h2>
        <p>
          When you choose to run a Pocket Bullseye audit, the chart image and any optional
          supporting image are sent to our configured AI provider so the requested audit can be
          produced. Remove names, account numbers, balances, notifications and any other personal
          information before uploading. Pocket requests that the provider does not store the AI
          response for later retrieval, although limited provider safety and abuse-monitoring
          retention may still apply.
        </p>
        <p>
          Pocket does not place trades or connect an uploaded chart to a brokerage account. Saved
          decisions and their chart images are stored locally in that browser using device storage;
          they are not synchronised to a NASH AI Markets account. Clearing the browser&apos;s site data
          removes them. A shared text summary does not include the chart image.
        </p>
        <p>
          To prevent duplicate charges and protect the service from automated or excessive use,
          Pocket creates a random device identifier and converts it to a salted one-way hash on the
          server. We retain monthly request counts, model and token totals, and short-lived structured
          audit results for cost control and service reliability. Uploaded chart images are not stored
          in this cache. Cached audit results expire from use after 24 hours and are keyed only by a
          one-way hash of the exact request. These records are not used for advertising or profiling.
          Our hosting provider may separately process ordinary technical request logs to operate and
          secure the service.
        </p>

        <h2>Retention and your rights</h2>
        <p>
          We retain information only as long as reasonably necessary. UK data-protection law may
          give you rights to access, correct, erase or restrict use of your personal information,
          and to object or complain to the Information Commissioner’s Office.
        </p>

        <h2>Cookies, local storage and service providers</h2>
        <p>
          Supabase supplies authentication and database services, Stripe processes subscriptions,
          the hosting provider processes necessary technical requests, and the configured
          market-data provider supplies market information. Essential authentication cookies are
          used to keep members signed in. No marketing cookies are described by this policy.
        </p>
        <p>
          Bullseye may use storage on your device for non-sensitive preferences, personal levels,
          checklist progress and comparisons between verified display states. These convenience
          records stay in that browser, can be reset in the relevant product controls or cleared
          through your browser, and do not change Bullseye’s verified evidence or decision engine.
        </p>
        <p>
          The optional TradingView chart loads only after a member chooses to open it. TradingView
          may receive the displayed symbol, the page URL and technical information such as the IP
          address needed to deliver the widget. TradingView states that its widgets do not set
          cookies. Values shown inside the widget are display-only, may be delayed or unavailable,
          and never enter Bullseye’s verified feed or decision engine.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions or requests, email{" "}
          <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.
        </p>
      </article>
    </main>
  );
}
