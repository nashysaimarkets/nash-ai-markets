import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { WaitlistForm } from "./WaitlistForm.tsx";

export const metadata: Metadata = {
  title: "Launch Waiting List",
  description: "Request launch and access updates for NASH AI Markets.",
};

export default function WaitlistPage() {
  return <main className="launchPage">
    <header className="launchPageNav"><BrandLogo context="launch" compactOnMobile /><Link href="/login">Member login</Link></header>
    <section className="launchHero">
      <div className="launchHeroCopy"><span>NASH AI MARKETS · LAUNCH ACCESS</span><h1>Join the launch waiting list.</h1><p>Request product and access updates for NASH AI Markets. Requests are handled without fake urgency, guaranteed places, or automatic billing.</p><ul><li>Provider-backed market context</li><li>Deterministic decision support</li><li>Fail-closed risk controls</li></ul></div>
      <div className="launchFormCard"><span>REQUEST UPDATES</span><h2>Register your interest</h2><p>We will use your email only for relevant NASH AI Markets launch communication and account follow-up. No guaranteed invitation and no automatic billing.</p><WaitlistForm /><footer>Educational market commentary only. Joining the list is not financial advice or a subscription purchase.</footer></div>
    </section>
    <footer className="launchFooter"><BrandLogo compactOnMobile /><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><span>© 2026 NASH AI Markets</span></footer>
  </main>;
}
