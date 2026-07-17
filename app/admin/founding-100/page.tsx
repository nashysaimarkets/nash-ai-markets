import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server.ts";
import { isFounding100Admin, loadFounding100Report } from "../../lib/server/founding-100.ts";
import { TerminalBadge } from "../../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Founding 100 Administration",
  robots: { index: false, follow: false },
};

export default async function Founding100AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isFounding100Admin(user.email)) redirect("/dashboard");

  const report = await loadFounding100Report();
  return <main className="foundingAdminPage">
    <header><div><span>RESTRICTED OPERATIONS</span><h1>Founding 100 report</h1><p>Server-verified awards only. Positions include active and forfeited records and are never reused.</p></div><Link href="/dashboard">Return to dashboard</Link></header>
    {report.status === "unavailable" ? <section className="foundingAdminUnavailable" role="alert"><h2>Founding reporting unavailable</h2><p>The database could not be verified. No availability or member list is inferred.</p></section> : <>
      <section className="foundingAdminSummary" aria-label="Founding programme availability">
        <article><span>FOUNDING 100 PRO</span><strong>{report.proRemaining}</strong><small>places remaining</small></article>
        <article><span>FOUNDING 100 ELITE</span><strong>{report.eliteRemaining}</strong><small>places remaining</small></article>
        <article><span>TOTAL AWARDED</span><strong>{report.records.length}</strong><small>positions permanently allocated</small></article>
      </section>
      <section className="foundingAdminTable" aria-labelledby="founding-members-title">
        <header><div><span>AWARD REGISTER</span><h2 id="founding-members-title">Members who earned Founding status</h2></div><TerminalBadge label={`${report.records.filter((record) => record.status === "active").length} active`} tone="positive" /></header>
        {report.records.length ? <div className="foundingAdminTableScroll"><table><thead><tr><th>Programme</th><th>Position</th><th>Member</th><th>Status</th><th>Price lock</th><th>Earned</th></tr></thead><tbody>{report.records.map((record) => <tr key={`${record.programme}-${record.position}`}><td>Founding 100 {record.programme.toUpperCase()}</td><td>#{record.position}</td><td>{record.email}</td><td>{record.status}</td><td>{record.priceLockActive ? "Active" : "Forfeited"}</td><td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(record.earnedAt))}</td></tr>)}</tbody></table></div> : <p className="foundingAdminEmpty">No Founding 100 positions have been awarded.</p>}
      </section>
    </>}
  </main>;
}
