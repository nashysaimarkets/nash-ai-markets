import type { Metadata } from "next";
import Link from "next/link";
import { PublicDocumentShell } from "../components/PublicDocumentShell";

export const metadata: Metadata = { title: "Help Centre", description: "NASH AI Markets account and product guidance." };

export default function HelpPage() {
  return (
    <PublicDocumentShell
      eyebrow="Help centre"
      title="How can we help?"
      description="Get started, manage your membership and understand the safety states built into Bullseye."
    >
      <h2>Getting started</h2>
      <p><Link href="/onboarding">Complete workspace setup</Link>, then open the dashboard to review access, market status and today’s brief.</p>
      <h2>Membership and billing</h2>
      <p><Link href="/pricing">Compare memberships</Link> or use the secure Stripe customer portal from your profile to manage an active subscription.</p>
      <h2>Awaiting verified data</h2>
      <p>Bullseye intentionally withholds directional output when verified data is unavailable. Refresh later and check the terminal provider status before relying on any analysis.</p>
      <h2>Install the application</h2>
      <p>On supported browsers, use the intentional install action in the member experience. On iPhone Safari, use Share and select Add to Home Screen. Offline mode never presents account or market information as current.</p>
      <h2>Still need help?</h2>
      <p><Link href="/contact">Contact support</Link>. We will never ask for your password, API key or full payment-card details.</p>
    </PublicDocumentShell>
  );
}
