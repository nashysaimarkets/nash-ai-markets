import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact", description: "Contact NASH AI Markets support." };

export default function ContactPage() {
  return <main className="legal"><header><Link href="/">← NASH AI MARKETS</Link></header><article>
    <span>SUPPORT</span><h1>Contact NASH AI Markets</h1>
    <p>For account, billing, privacy or product questions, email <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.</p>
    <h2>Include safely</h2><p>Tell us whether you use the iOS app or web membership and give a concise description of the issue. Never send passwords, API keys, full payment-card details, Apple Account credentials or authentication links.</p>
    <h2>Apple App Store subscriptions</h2><p>Manage or cancel an App Store subscription in your Apple Account subscription settings. Use Restore Purchases inside Pocket Bullseye to check an eligible active entitlement. Apple handles App Store billing and eligible refund requests; request or check a refund at <a href="https://reportaproblem.apple.com/" target="_blank" rel="noreferrer">reportaproblem.apple.com</a>. For an app-function problem, email us and include the approximate date and the exact message shown, but do not send payment credentials.</p>
    <h2>Stripe web memberships</h2><p>Use the secure Stripe customer portal from your web profile for subscription changes. Apple cannot manage or refund a web membership. For a web payment issue, include the approximate date only—never full card information.</p>
    <h2>Market-data incidents</h2><p>If a panel appears stale or unavailable, include the displayed provider status and timestamp. Do not send provider credentials or authenticated URLs.</p>
  </article></main>;
}
