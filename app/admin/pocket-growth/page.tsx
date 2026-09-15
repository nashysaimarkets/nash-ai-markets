import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server.ts";
import { createAdminClient } from "../../../utils/supabase/admin.ts";
import { isFounding100Admin } from "../../lib/server/founding-100.ts";
import "../commercial/launch-dashboard.css";
import "./growth.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pocket customer journey", robots: { index: false, follow: false } };
type EventRow = { event: string; platform: string; flow: string; total: number; average_ms: number };
type SourceRow = { source: string; campaign: string; views: number; samples: number; app_store_clicks: number };
const labels: Record<string, string> = { introduction_viewed: "Introduction views", app_opened: "App opens", sample_viewed: "Fictional sample opened", app_store_clicked: "App Store link clicks", chart_uploaded: "Charts uploaded", scan_started: "Main analyses started", scan_completed: "Results shown", scan_failed: "Main analyses failed", paywall_viewed: "Subscription screen shown", purchase_started: "Apple purchase started", purchase_completed: "Apple purchase confirmed in app", purchase_incomplete: "Apple purchase not completed", purchase_failed: "Apple purchase error", restore_completed: "Apple access restored" };

export default async function PocketGrowthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isFounding100Admin(user.email)) redirect("/dashboard");
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  let report: { events: EventRow[]; sources: SourceRow[] } | null = null;
  try {
    const { data, error } = await createAdminClient().rpc("pocket_growth_report", { p_from: since });
    if (error || !data || !Array.isArray(data.events) || !Array.isArray(data.sources)) throw new Error("unavailable");
    report = data;
  } catch { /* Unknown is never displayed as zero. */ }
  return <main className="foundingAdminPage launchDashboard pocketGrowth"><header><div><span>OWNER ONLY · LAST 30 UTC DAYS</span><h1>Where do customers stop?</h1><p>Anonymous activity totals from {since}. Test-tagged activity is excluded.</p></div><Link href="/admin/commercial">Stripe web subscriptions</Link></header>
    <section className="growthNote"><h2>Read these numbers correctly</h2><p>These are actions, not unique people. Samples do not count as real scans. Repeat visits, unflagged owner activity and missed events can affect totals. No individual browsing trail is stored.</p><p>Apple activity covers versions with reporting enabled. Older installed versions cannot report these events. App Store clicks are not downloads, and in-app purchase events are not an independent sales ledger. Use <a href="https://appstoreconnect.apple.com/">App Store Connect</a> for Apple downloads and paid subscriptions; use the separate Stripe report for web subscriptions.</p></section>
    {!report ? <section role="alert"><h2>Activity reporting unavailable</h2><p>No figures have been estimated. Retry later.</p></section> : <>
      <section><h2>Discovery, analysis and subscription</h2>{report.events.length ? <div className="growthTable"><table><thead><tr><th>Action</th><th>Platform</th><th>Type</th><th>Count</th><th>Average time</th></tr></thead><tbody>{report.events.map(row => <tr key={`${row.event}:${row.platform}:${row.flow}`}><td>{labels[row.event] ?? row.event}</td><td>{row.platform === "apple" ? "iPhone app" : "Web"}</td><td>{row.flow}</td><td>{row.total}</td><td>{row.event === "scan_completed" || row.event === "scan_failed" ? `${Math.round(row.average_ms / 1000)}s` : "—"}</td></tr>)}</tbody></table></div> : <p>No activity has been recorded for this period. This does not establish zero visitors or zero Apple subscribers.</p>}</section>
      <section><h2>Promotion sources</h2><p>Use the same labelled link throughout a campaign. Direct App Store visits and earlier unlabelled promotions cannot be attributed here.</p>{report.sources.length ? <div className="growthTable"><table><thead><tr><th>Source</th><th>Campaign</th><th>Introduction views</th><th>Samples</th><th>App Store clicks</th></tr></thead><tbody>{report.sources.map(row => <tr key={`${row.source}:${row.campaign}`}><td>{row.source}</td><td>{row.campaign}</td><td>{row.views}</td><td>{row.samples}</td><td>{row.app_store_clicks}</td></tr>)}</tbody></table></div> : <p>No campaign activity recorded yet.</p>}</section>
    </>}
  </main>;
}
