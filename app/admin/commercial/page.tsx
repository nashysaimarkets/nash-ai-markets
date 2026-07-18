import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server.ts";
import { isFounding100Admin, loadFounding100Availability } from "../../lib/server/founding-100.ts";
import { loadCommercialReport } from "../../lib/server/commercial.ts";
import { BrandLogo } from "../../components/BrandLogo.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commercial Administration", robots: { index: false, follow: false } };

const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export default async function CommercialAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isFounding100Admin(user.email)) redirect("/dashboard");
  const [report, founding] = await Promise.all([loadCommercialReport(), loadFounding100Availability()]);
  return <main className="foundingAdminPage"><BrandLogo audience="member" context="bullseye" /><header><div><span>RESTRICTED OPERATIONS</span><h1>Commercial report</h1><p>Metrics use stored Stripe-synchronized membership records. Unverified values are never estimated.</p></div><div><Link href="/admin/founding-100">Founding register</Link><br /><Link href="/dashboard">Dashboard</Link></div></header>
    {report.status === "unavailable" ? <section className="foundingAdminUnavailable" role="alert"><h2>Commercial reporting unavailable</h2><p>No member or revenue value has been inferred.</p></section> : <section className="foundingAdminSummary commercialAdminGrid" aria-label="Commercial metrics">
      <article><span>FREE MEMBERS</span><strong>{report.metrics.free}</strong><small>registered accounts without active paid access</small></article>
      <article><span>PRO MEMBERS</span><strong>{report.metrics.pro}</strong><small>active or trialing</small></article>
      <article><span>ELITE MEMBERS</span><strong>{report.metrics.elite}</strong><small>active or trialing</small></article>
      <article><span>MONTHLY / ANNUAL</span><strong>{report.metrics.monthly} / {report.metrics.annual}</strong><small>verified paid cadence</small></article>
      <article><span>MRR</span><strong>{money(report.metrics.mrrPence)}</strong><small>annual subscriptions normalized monthly</small></article>
      <article><span>ARR</span><strong>{money(report.metrics.arrPence)}</strong><small>active recurring run rate</small></article>
      <article><span>CONVERSION</span><strong>{report.metrics.conversionPercent === null ? "—" : `${report.metrics.conversionPercent}%`}</strong><small>active paid / registered accounts</small></article>
      <article><span>FOUNDING PRO</span><strong>{founding.proRemaining ?? "—"}</strong><small>remaining permanent allocation</small></article>
      <article><span>FOUNDING ELITE</span><strong>{founding.eliteRemaining ?? "—"}</strong><small>remaining permanent allocation</small></article>
    </section>}
  </main>;
}
