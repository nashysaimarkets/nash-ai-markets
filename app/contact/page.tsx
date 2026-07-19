import type { Metadata } from "next";
import { PublicDocumentShell } from "../components/PublicDocumentShell";

export const metadata: Metadata = { title: "Contact", description: "Contact NASH AI Markets support." };

export default function ContactPage() {
  return (
    <PublicDocumentShell
      eyebrow="Support · Member care"
      title="Clear support, without compromising security."
      description="For account, billing, privacy or product questions, contact hello@nashaimarkets.com. We will never ask for passwords, authentication links or full payment-card information."
    >
      <h2>Include safely</h2>
      <p>Tell us the email address associated with your account and a concise description of the issue. Never send passwords, API keys, payment-card details or authentication links.</p>
      <h2>Billing</h2>
      <p>Use the secure Stripe customer portal from your profile for subscription changes. For a payment issue, include the approximate date only—never full card information.</p>
      <h2>Market-data incidents</h2>
      <p>If a panel appears stale or unavailable, include the displayed provider status and timestamp. Do not send provider credentials or authenticated URLs.</p>
      <h2>Contact</h2>
      <p>Email <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.</p>
    </PublicDocumentShell>
  );
}
