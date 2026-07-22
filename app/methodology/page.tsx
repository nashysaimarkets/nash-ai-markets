import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { METHODOLOGY_VERSION } from "../lib/market-analysis-snapshot.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bullseye Methodology | NASH AI Markets",
  description: "How Bullseye scores, no-trade rules, options framing, archive and results work — including hard limits.",
  robots: { index: false, follow: false },
};

export default async function MethodologyPage() {
  await requireMemberPage();

  return <MemberShell active="methodology" className="methodologyPage">
    <div className="memberDashboardShell">
      <section className="methodologyHero">
        <div>
          <span>EDUCATION</span>
          <h1>Bullseye methodology</h1>
          <p>Decision support with fail-closed honesty. Version {METHODOLOGY_VERSION}. Not financial advice.</p>
        </div>
        <div className="methodologyHeroStatus">
          <Link href="/risk-disclaimer">Risk disclosure</Link>
          <Link href="/help">Help centre</Link>
        </div>
      </section>

      <section className="methodologyGrid">
        <DashboardCard eyebrow="SCORE" title="Bullseye score" className="methodologyCard">
          <p>The Bullseye score summarises decision confidence from verified cross-asset evidence when the market snapshot is decision-ready.</p>
          <p>If data is delayed, incomplete or unavailable, the score is withheld rather than shown as a misleading zero.</p>
        </DashboardCard>

        <DashboardCard eyebrow="NO-TRADE" title="No-trade discipline" className="methodologyCard">
          <p>Trade permission can close when evidence conflicts, volatility is extreme, data is stale, or event risk dominates.</p>
          <p>No-trade is a first-class outcome — not a failed feature. Standing aside is part of the process.</p>
        </DashboardCard>

        <DashboardCard eyebrow="CONFIRM / INVALIDATE" title="Confirmation and invalidation" className="methodologyCard">
          <p>Plans list required confirmations before participation and invalidation conditions that would close the case.</p>
          <p>These are process gates derived from the engines, not guarantees that price will respect them.</p>
        </DashboardCard>

        <DashboardCard eyebrow="OPTIONS" title="Options methodology limits" className="methodologyCard">
          <p>Options Corner is an underlying-based framework. Without a verified options-chain provider, strikes, premiums, Greeks and expected-move figures are withheld.</p>
          <p>Idea cards describe structure logic only. They are educational and must not be treated as executable option tickets.</p>
        </DashboardCard>

        <DashboardCard eyebrow="HISTORY" title="Historical-record limitations" className="methodologyCard">
          <p>Yesterday’s Review and Archive show stored snapshot payloads only. Engines are not re-run to rewrite “what the original was.”</p>
          <p>If a session candle series was never stored, OHLC comparison stays unavailable — Bullseye does not invent prints.</p>
        </DashboardCard>

        <DashboardCard eyebrow="REPLAY" title="Replay methodology" className="methodologyCard">
          <p>Replay Beta inspects stored plans and known snapshot timestamps for a selected session date.</p>
          <p>Candle playback requires verified history for that date. Incomplete or degraded days are marked ineligible instead of simulated.</p>
        </DashboardCard>

        <DashboardCard eyebrow="RESULTS" title="Results methodology" className="methodologyCard">
          <p>Results Centre foundations aggregate posture distribution, sample size and date coverage from market_analysis_snapshots.</p>
          <p>This release does not compute predictive accuracy or trade hit rates. Empty archives mean recording begins forward — not backfilled fiction.</p>
        </DashboardCard>

        <DashboardCard eyebrow="RISK" title="Risk disclosure" className="methodologyCard">
          <p>Futures and options involve substantial risk of loss and are not suitable for every investor.</p>
          <p>Review the formal disclosures before acting on any Bullseye output.</p>
          <p>
            <Link href="/risk-disclaimer">Risk disclaimer</Link>
            {" · "}
            <Link href="/terms">Terms</Link>
            {" · "}
            <Link href="/privacy">Privacy</Link>
          </p>
        </DashboardCard>
      </section>
    </div>
  </MemberShell>;
}
