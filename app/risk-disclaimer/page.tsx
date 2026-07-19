import type { Metadata } from "next";
import { PublicDocumentShell } from "../components/PublicDocumentShell";

export const metadata: Metadata = { title: "Risk Disclaimer", description: "Important trading risk information for NASH AI Markets members." };

export default function RiskDisclaimer() {
  return (
    <PublicDocumentShell eyebrow="Important risk information" title="Risk Disclaimer" description="Trading futures, options and leveraged products involves substantial risk and is not suitable for everyone.">
      <p>Losses may occur rapidly and can exceed the amount initially committed.</p>
      <h2>Educational information</h2><p>NASH AI Markets provides general educational commentary and decision-support tooling. Nothing presented is personalised financial, investment, tax or legal advice.</p>
      <h2>No guarantee</h2><p>Scores, scenarios, confidence measures and historical classifications do not guarantee profitability or predict future performance. Data may be delayed, incomplete or unavailable.</p>
      <h2>Your responsibility</h2><p>You remain solely responsible for verifying information, determining suitability, setting risk limits and making every trading decision. If you are uncertain, seek advice from an appropriately authorised professional.</p>
    </PublicDocumentShell>
  );
}
