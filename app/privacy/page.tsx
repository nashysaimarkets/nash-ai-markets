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
        <p className="updated">Last updated: 16 August 2026</p>

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
