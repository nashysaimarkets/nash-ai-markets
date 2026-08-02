import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server.ts";
import { MemberShell } from "../../components/MemberShell.tsx";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart.tsx";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import { isFounding100Admin } from "../../lib/server/founding-100.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard visual preview | NASH AI Markets",
  robots: { index: false, follow: false },
};

function demoSeries(): CustomerCandleSeries {
  const end = Math.floor(Date.now() / 300_000) * 300;
  let close = 100;
  const candles = Array.from({ length: 72 }, (_, index) => {
    const wave = Math.sin(index / 4.8) * 0.42 + Math.cos(index / 9.2) * 0.2;
    const drift = index < 24 ? 0.08 : index < 48 ? -0.035 : 0.11;
    const open = close;
    close = Math.max(96, open + wave * 0.34 + drift);
    return {
      time: end - (71 - index) * 300,
      open,
      high: Math.max(open, close) + 0.22 + (index % 3) * 0.04,
      low: Math.min(open, close) - 0.2 - (index % 4) * 0.035,
      close,
      volume: 900 + ((index * 137) % 1100),
    };
  });
  return {
    symbol: "DEMO-ES",
    contract: "VISUAL PREVIEW",
    instrumentName: "S&P 500 futures visual preview",
    exchange: "SYNTHETIC DESIGN DATA",
    instrumentDetail: "Illustrative chart geometry used only to preview the completed interface.",
    timeframe: "5m",
    classification: "delayed",
    dataAgeMs: 0,
    provider: "Financial Modeling Prep",
    status: "delayed",
    asOf: new Date(end * 1000).toISOString(),
    candles,
    failureCategory: null,
  };
}

export default async function DashboardVisualPreviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login?next=/admin/visual-preview");
  if (!isFounding100Admin(user.email)) redirect("/dashboard");

  return (
    <MemberShell active="dashboard">
      <main className="visualPreviewPage">
        <section className="visualPreviewNotice" role="note">
          <div>
            <span>OWNER-ONLY DESIGN MODE</span>
            <h1>How Bullseye looks with populated charts</h1>
            <p>Every value below is synthetic design data. This page previews layout and interaction only—it is never used for market decisions.</p>
          </div>
          <Link href="/dashboard">Return to verified dashboard</Link>
        </section>
        <DashboardCandlestickChart series={demoSeries()} instrument="ES" />
        <section className="visualPreviewCards" aria-label="Populated dashboard card preview">
          <article><span>MARKET STRUCTURE</span><strong>Balanced auction</strong><i className="previewLane"><b style={{ width: "62%" }} /></i><small>Illustrative range-position treatment</small></article>
          <article><span>VOLATILITY REGIME</span><strong>Moderate</strong><i className="previewGauge"><b style={{ transform: "rotate(18deg)" }} /></i><small>Illustrative risk-gauge treatment</small></article>
          <article><span>CROSS-ASSET PRESSURE</span><strong>Mixed / neutral</strong><i className="previewBars"><b /><b /><b /></i><small>Illustrative evidence treatment</small></article>
        </section>
        <p className="visualPreviewFooter">DEMO VISUALS · NOT LIVE · NOT DELAYED MARKET DATA · NOT A TRADING SIGNAL</p>
      </main>
    </MemberShell>
  );
}
