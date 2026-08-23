import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server.ts";
import { isFounding100Admin, loadFounding100Availability } from "../../lib/server/founding-100.ts";
import { loadCommercialReport, loadPocketLaunchReport, loadWaitlistMetrics } from "../../lib/server/commercial.ts";
import "./launch-dashboard.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commercial Administration", robots: { index: false, follow: false } };

const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "—";

export default async function CommercialAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isFounding100Admin(user.email)) redirect("/dashboard");
  const [report, founding, waitlist, pocket] = await Promise.all([
    loadCommercialReport(),
    loadFounding100Availability(),
    loadWaitlistMetrics(),
    loadPocketLaunchReport(),
  ]);
  return <main className="foundingAdminPage launchDashboard"><header><div><span>OWNER ONLY · LIVE STRIPE REPORT</span><h1>Pocket launch control</h1><p>Verified subscription and payment information from Stripe. Figures refresh whenever this page is opened.</p></div><div><Link href="/admin/founding-100">Founding register</Link><br /><Link href="/dashboard">Main dashboard</Link></div></header>
    {pocket.status === "unavailable" ? <section className="foundingAdminUnavailable" role="alert"><h2>Live Pocket figures temporarily unavailable</h2><p>Nothing has been estimated. Retry shortly or review Stripe directly.</p></section> : <>
      <section className="launchStatus"><i></i><span>LIVE CONNECTION</span><strong>Stripe reporting verified</strong><small>Last checked {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date())}</small></section>
      <section className="foundingAdminSummary launchMetrics" aria-label="Pocket launch metrics">
        <article className="launchHeroMetric"><span>ACTIVE POCKET SUBSCRIBERS</span><strong>{pocket.metrics.activeSubscribers}</strong><small>Active or trialling £4.99 memberships</small></article>
        <article><span>POCKET MRR</span><strong>{money(pocket.metrics.mrrPence)}</strong><small>Verified monthly recurring value</small></article>
        <article><span>COLLECTED · 30 DAYS</span><strong>{money(pocket.metrics.collected30dPence)}</strong><small>Paid Pocket invoices in GBP</small></article>
        <article data-alert={pocket.metrics.failedPayments > 0}><span>PAYMENT PROBLEMS</span><strong>{pocket.metrics.failedPayments}</strong><small>Open invoices with a failed attempt</small></article>
        <article data-alert={pocket.metrics.cancellationScheduled > 0}><span>CANCELLING</span><strong>{pocket.metrics.cancellationScheduled}</strong><small>Access active until period end</small></article>
        <article><span>CANCELLED</span><strong>{pocket.metrics.cancelled}</strong><small>Historic Pocket subscriptions</small></article>
      </section>
      <section className="foundingAdminTable launchMembers" aria-labelledby="recent-pocket-members"><header><div><span>NEWEST FIRST</span><h2 id="recent-pocket-members">Recent Pocket subscriptions</h2></div><b>{pocket.recentMembers.length} shown</b></header>
        {pocket.recentMembers.length ? <div className="foundingAdminTableScroll"><table><thead><tr><th>Customer</th><th>Status</th><th>Joined</th><th>Renews / ends</th></tr></thead><tbody>{pocket.recentMembers.map((member) => <tr key={member.id}><td>{member.email}</td><td><mark data-status={member.cancellationScheduled ? "ending" : member.status}>{member.cancellationScheduled ? "ending" : member.status}</mark></td><td>{date(member.joinedAt)}</td><td>{date(member.renewsAt)}</td></tr>)}</tbody></table></div> : <p className="foundingAdminEmpty">No Pocket subscriptions have been recorded in Stripe yet.</p>}
      </section>
    </>}
    <section className="launchSecondary"><span>WIDER BUSINESS</span><h2>NASH AI Markets overview</h2></section>
    {report.status === "unavailable" ? <section className="foundingAdminUnavailable" role="alert"><h2>Commercial reporting unavailable</h2><p>No member or revenue value has been inferred.</p></section> : <section className="foundingAdminSummary commercialAdminGrid" aria-label="Commercial metrics">
      <article><span>FREE MEMBERS</span><strong>{report.metrics.free}</strong><small>registered accounts without active paid access</small></article>
      <article><span>PRO MEMBERS</span><strong>{report.metrics.pro}</strong><small>active or trialing</small></article>
      <article><span>ELITE MEMBERS</span><strong>{report.metrics.elite}</strong><small>active or trialing</small></article>
      <article><span>MONTHLY / ANNUAL</span><strong>{report.metrics.monthly} / {report.metrics.annual}</strong><small>verified paid cadence</small></article>
      <article><span>MRR</span><strong>{money(report.metrics.mrrPence)}</strong><small>annual subscriptions normalized monthly</small></article>
      <article><span>ARR</span><strong>{money(report.metrics.arrPence)}</strong><small>active recurring run rate</small></article>
      <article><span>CONVERSION</span><strong>{report.metrics.conversionPercent === null ? "—" : `${report.metrics.conversionPercent}%`}</strong><small>active paid / registered accounts</small></article>
      <article><span>FOUNDING PRO INTEREST</span><strong>{waitlist.metrics?.foundingProInterest ?? "—"}</strong><small>waiting-list records from the £12 launch offer</small></article>
      <article><span>TOTAL WAITING LIST</span><strong>{waitlist.metrics?.total ?? "—"}</strong><small>server-recorded launch interest</small></article>
      <article><span>FOUNDING PRO</span><strong>{founding.proRemaining ?? "—"}</strong><small>remaining permanent allocation</small></article>
      <article><span>FOUNDING ELITE</span><strong>{founding.eliteRemaining ?? "—"}</strong><small>remaining permanent allocation</small></article>
    </section>}
  </main>;
}
