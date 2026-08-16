import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { WaitlistForm } from "./WaitlistForm.tsx";

export const metadata: Metadata = {
  title: "Launch Waiting List",
  description: "Request launch and access updates for NASH AI Markets.",
  alternates: {
    canonical: "/waitlist",
  },
  openGraph: {
    title: "Join the NASH AI Markets Launch Waiting List",
    description: "Request launch and access updates for NASH AI Markets.",
    url: "/waitlist",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join the NASH AI Markets Launch Waiting List",
    description: "Request launch and access updates for NASH AI Markets.",
  },
};

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const query = await searchParams;
  const foundingPro = query.plan === "founding-pro";
  return <main className="launchPage">
    <header className="launchPageNav"><BrandLogo /><Link href="/login">Member login</Link></header>
    <section className="launchHero">
      <div className="launchHeroCopy"><span>NASH AI MARKETS · {foundingPro ? "FOUNDING PRO" : "LAUNCH ACCESS"}</span><h1>{foundingPro ? "Reserve your interest in Founding Pro." : "Join the launch waiting list."}</h1><p>{foundingPro ? "Register interest in the £12/month Founding Pro launch offer. The offer is intended for the first 100 verified successful subscribers once checkout opens; joining this list is not a purchase and does not guarantee a place." : "Request product and access updates for NASH AI Markets. Requests are handled without fake urgency, guaranteed places, or automatic billing."}</p><ul><li>Official macro and event context</li><li>Licensed intraday status when available</li><li>Fail-closed decision controls</li></ul></div>
      <div className="launchFormCard"><span>{foundingPro ? "FOUNDING PRO INTEREST" : "REQUEST UPDATES"}</span><h2>{foundingPro ? "Register launch-offer interest" : "Register your interest"}</h2><p>We will use your email only for relevant NASH AI Markets launch communication and account follow-up. No guaranteed invitation and no automatic billing.</p><WaitlistForm foundingPro={foundingPro} /><footer>Educational market commentary only. Joining the list is not financial advice or a subscription purchase.</footer></div>
    </section>
    <footer className="launchFooter"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><span>© 2026 NASH AI Markets</span></footer>
  </main>;
}
