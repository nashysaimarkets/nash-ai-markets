import type { Metadata } from "next";
import { PublicDocumentShell } from "../components/PublicDocumentShell";

export const metadata: Metadata = { title: "About", description: "How NASH AI Markets builds transparent market decision support." };

export default function AboutPage() {
  return (
    <PublicDocumentShell
      eyebrow="Company · Methodology"
      title="Preparation over prediction."
      description="NASH AI Markets builds disciplined, explainable market intelligence for traders who value a calm process, visible uncertainty and risk-aware decisions."
    >
      <h2>Our approach</h2>
      <p>Bullseye combines verified provider data with deterministic intelligence, decision and planning engines. When current inputs cannot be verified, trading guidance fails closed rather than filling gaps with invented values.</p>
      <h2>What we are not</h2>
      <p>We are not a broker, investment adviser or trade-execution service. We do not guarantee outcomes or provide personalised recommendations.</p>
      <h2>Our standard</h2>
      <p>Every market state should communicate provenance, freshness, uncertainty and risk clearly enough for a member to decide whether to continue analysis or stand aside.</p>
    </PublicDocumentShell>
  );
}
