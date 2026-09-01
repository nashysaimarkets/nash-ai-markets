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
        <p className="updated">Last updated: 1 September 2026</p>

        <h2>Who we are</h2>
        <p>
          NASH AI Markets provides educational market commentary. You can contact us at{" "}
          <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.
        </p>

        <h2>Information we collect</h2>
        <p>
          For web members, we process account email addresses, optional profile details, web
          membership and access records, web founding-offer status and price-lock records,
          authentication-session data, and support messages. Stripe processes web membership
          payments; we retain the customer, subscription, status and billing-period identifiers
          needed to grant web access. We do not store full payment-card details.
        </p>

        <h2>App Store purchases</h2>
        <p>
          Apple processes your Apple Account and payment method for purchases made in the iOS app.
          Pocket Bullseye uses StoreKit on the device to retrieve the subscription product, active
          entitlement and transaction identifiers needed to provide or restore access. The current
          iOS app does not send those StoreKit transaction identifiers to NASH AI Markets&apos; server,
          and we do not receive your full card or Apple Account payment details. Apple separately
          handles purchase information under its{" "}
          <a href="https://www.apple.com/legal/privacy/data/en/app-store/" target="_blank" rel="noreferrer">
            App Store privacy information
          </a>.
        </p>

        <h2>How we use information</h2>
        <p>
          We use information to authenticate web members, manage subscriptions and feature access
          for the channel through which access was purchased, provide or restore iOS entitlement,
          operate reasonable request limits, prevent abuse, respond to enquiries, operate and
          secure the service, and meet legal obligations. We do not sell personal information.
        </p>

        <h2>Pocket Bullseye chart audits</h2>
        <p>
          When you choose to run a Pocket Bullseye audit, the chart image and any optional
          supporting image are sent to OpenAI, our configured AI provider, so the requested audit
          can be produced. Remove names, account numbers, balances, notifications and any other
          personal information before uploading. Pocket requests that the provider does not store
          the AI response for later retrieval, although limited provider safety and abuse-monitoring
          retention may still apply.
        </p>
        <p>
          Pocket does not place trades or connect an uploaded chart to a brokerage account. Saved
          decisions and their chart images are stored locally in the relevant browser or app on the
          device; they are not synchronised to a NASH AI Markets account. Clearing browser data or
          deleting app data may remove them. A shared text summary does not include the chart image.
        </p>
        <p>
          To protect Pocket Bullseye from automated or excessive use, Pocket derives a pseudonymous
          request key from technical network information and keeps only a short-lived request count
          in volatile server memory. The counter automatically expires and is not used for
          advertising or profiling. Our hosting provider may separately process ordinary technical
          request logs to operate and secure the service.
        </p>

        <h2>Retention and your rights</h2>
        <p>
          We retain information only as long as reasonably necessary. UK data-protection law may
          give you rights to access, correct, erase or restrict use of your personal information,
          and to object or complain to the Information Commissioner&apos;s Office.
        </p>

        <h2>Cookies, local storage and service providers</h2>
        <p>
          Supabase supplies web authentication and database services, Stripe processes web
          memberships, Apple StoreKit processes iOS in-app purchases and entitlement checks, the
          hosting provider processes necessary technical requests, and the configured market-data
          provider supplies market information. Essential authentication cookies are used to keep
          web members signed in. No marketing cookies are described by this policy.
        </p>
        <p>
          Bullseye may use storage on your device for non-sensitive preferences, personal levels,
          checklist progress and comparisons between verified display states. These convenience
          records stay in the relevant browser or app on the device and can be reset in product
          controls or removed through the device&apos;s browser or app storage controls. They do not
          change Bullseye&apos;s verified evidence or decision engine.
        </p>
        <p>
          The optional TradingView chart loads only after a member chooses to open it. TradingView
          may receive the displayed symbol, the page URL and technical information such as the IP
          address needed to deliver the widget. TradingView states that its widgets do not set
          cookies. Values shown inside the widget are display-only, may be delayed or unavailable,
          and never enter Bullseye&apos;s verified feed or decision engine.
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
