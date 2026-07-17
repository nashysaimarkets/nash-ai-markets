import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm.tsx";

export const metadata: Metadata = {
  title: "Private Beta Waiting List",
  description: "Request launch updates for the NASH AI Markets private beta.",
};

export default function WaitlistPage() {
  return <main className="launchPage">
    <header className="launchPageNav"><Link href="/" className="ftBrand"><span className="ftReticle" aria-hidden="true" /><span>NASH <b>AI</b> / OPERATION LAUNCH</span></Link><Link href="/login">Member login</Link></header>
    <section className="launchHero">
      <div className="launchHeroCopy"><span>SPRINT DELTA · PRIVATE BETA</span><h1>Join the launch waiting list.</h1><p>Request product and access updates for NASH AI Markets. Applications are reviewed without fake urgency, guaranteed places, or automatic billing.</p><ul><li>Provider-backed market context</li><li>Deterministic decision support</li><li>Fail-closed risk controls</li></ul></div>
      <div className="launchFormCard"><span>REQUEST UPDATES</span><h2>Be considered for private beta access</h2><p>We will use your email only for relevant NASH AI Markets launch communication and account follow-up. No guaranteed invitation.</p><WaitlistForm /><footer>Educational market commentary only. Joining the list is not financial advice or a subscription purchase.</footer></div>
    </section>
    <footer className="launchFooter"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><span>© 2026 NASH AI Markets</span></footer>
  </main>;
}
