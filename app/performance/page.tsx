import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { journalPerformance, listJournalEntries } from "../lib/server/trade-journal.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal Performance | NASH AI Markets",
  description: "Process analytics from your private trade journal once sample size is sufficient.",
  robots: { index: false, follow: false },
};

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export default async function PerformancePage() {
  const { user, access, previewState } = await requireMemberPage();

  if (!access.features.performance) {
    return <MemberShell active="performance" className="resultsPage">
      <div className="memberDashboardShell">
        <section className="resultsHero">
          <div>
            <span>JOURNAL PERFORMANCE</span>
            <h1>Your process analytics</h1>
            <p>Percentages appear only after enough closed trades with recorded P&amp;L.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="pro"
          title="Unlock journal performance"
          value="Pro and Elite members can review win rate and plan-follow metrics once sample size is honest."
          benefits={["Minimum sample gate", "No fabricated accuracy", "Tied to your journal only"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const journal = await listJournalEntries(user.id);
  if (!journal.available) {
    return <MemberShell active="performance" className="resultsPage">
      <div className="memberDashboardShell">
        <SafeState title="Journal migration pending" tone="warning">
          <p>Performance analytics require the trade journal table. No sample metrics are invented meanwhile.</p>
          <Link href="/journal">Open journal</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const stats = journalPerformance(journal.rows.map((row) => ({
    pnl: typeof row.pnl === "number" ? row.pnl : null,
    direction: String(row.direction ?? ""),
    instrument_class: String(row.instrument_class ?? ""),
    followed_plan: typeof row.followed_plan === "boolean" ? row.followed_plan : null,
    traded_at: String(row.traded_at ?? ""),
    vix_regime: typeof row.vix_regime === "string" ? row.vix_regime : null,
    bullseye_score: typeof row.bullseye_score === "number" ? row.bullseye_score : null,
  })));

  return <MemberShell active="performance" className="resultsPage">
    <div className="memberDashboardShell">
      <section className="resultsHero">
        <div>
          <span>JOURNAL PERFORMANCE</span>
          <h1>Process analytics</h1>
          <p>Derived only from your closed journal rows with recorded P&amp;L. No market accuracy claims.</p>
        </div>
        <div className="resultsHeroStatus">
          <TerminalBadge label={`Sample ${stats.sampleSize}`} tone={stats.sufficient ? "positive" : "warning"} />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          <Link href="/journal">Journal</Link>
        </div>
      </section>

      {!stats.sufficient ? (
        <SafeState title="Insufficient sample" tone="warning">
          <p>{stats.message}</p>
          <p>Current closed trades with P&amp;L: <strong>{stats.sampleSize}</strong>.</p>
        </SafeState>
      ) : (
        <section className="resultsMetrics" aria-label="Journal performance metrics">
          <article><span>Win rate</span><strong>{pct(stats.winRate)}</strong><small>{stats.sampleSize} closed trades</small></article>
          <article><span>Average win</span><strong>{stats.averageWin.toFixed(2)}</strong></article>
          <article><span>Average loss</span><strong>{stats.averageLoss.toFixed(2)}</strong></article>
          <article><span>Profit factor</span><strong>{stats.profitFactor == null ? "n/a" : stats.profitFactor.toFixed(2)}</strong></article>
        </section>
      )}

      <section className="resultsGrid">
        <DashboardCard eyebrow="MIX" title="Direction and instrument mix" className="resultsCard">
          {stats.sufficient ? (
            <dl>
              <div><dt>Long</dt><dd>{stats.longCount}</dd></div>
              <div><dt>Short</dt><dd>{stats.shortCount}</dd></div>
              <div><dt>Futures</dt><dd>{stats.futuresCount}</dd></div>
              <div><dt>Options</dt><dd>{stats.optionsCount}</dd></div>
            </dl>
          ) : <p>Mix detail unlocks with the same five-trade sample gate.</p>}
        </DashboardCard>
        <DashboardCard eyebrow="PROCESS" title="Plan adherence" className="resultsCard">
          {stats.sufficient ? (
            <dl>
              <div><dt>Followed plan</dt><dd>{stats.planFollowed}</dd></div>
              <div><dt>Broke plan</dt><dd>{stats.planBroken}</dd></div>
            </dl>
          ) : <p>Process percentages stay hidden until sample size is honest.</p>}
        </DashboardCard>
      </section>
    </div>
  </MemberShell>;
}
