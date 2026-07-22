import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardCard } from "../../components/DashboardCard.tsx";
import { MemberShell } from "../../components/MemberShell.tsx";
import { SafeState } from "../../components/SafeState.tsx";
import { BullseyeGauge } from "../../components/mini-visuals/BullseyeGauge.tsx";
import { formatScoreDisplay, scoreIsDisplayable } from "../../dashboard/lib/score-display.ts";
import { getLatestSnapshotForDate, listAnalysisSnapshots } from "../../lib/server/market-snapshots.ts";
import { requireMemberPage } from "../../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Archive ${date} | NASH AI Markets`,
    description: `Stored Bullseye analysis snapshot for session ${date}.`,
    robots: { index: false, follow: false },
  };
}

function formatLondon(iso: string | null | undefined) {
  if (!iso) return "Unavailable";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(ms));
}

export default async function ArchiveDayPage({ params }: PageProps) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const { access, previewState } = await requireMemberPage();
  if (!access.features.archive) {
    return <MemberShell active="archive" className="archivePage">
      <div className="memberDashboardShell">
        <LockedPremiumCard
          tier="pro"
          title="Unlock archive day detail"
          value="Pro and Elite members can open stored session snapshots for a specific date."
          benefits={["Stored payload only", "Honest empty states", "No re-scored history"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const listing = await listAnalysisSnapshots(120);
  if (!listing.available) {
    return <MemberShell active="archive" className="archivePage">
      <div className="memberDashboardShell">
        <SafeState title="Archive migration pending" tone="warning">
          <p>Session detail for {date} cannot be loaded until snapshot storage is available.</p>
          <Link href="/archive">Back to archive</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const dayRows = listing.rows.filter((row) => row.session_date === date);
  const latest = await getLatestSnapshotForDate(date);

  if (!latest || !dayRows.length) {
    return <MemberShell active="archive" className="archivePage">
      <div className="memberDashboardShell">
        <section className="archiveHero">
          <div>
            <span>ARCHIVE DAY</span>
            <h1>{date}</h1>
            <p>No stored analysis snapshot exists for this session date.</p>
          </div>
        </section>
        <SafeState title="Honest empty — nothing stored">
          <p>Bullseye will not invent a plan, score or candle series for {date}. Choose another date from the archive list once snapshots accumulate.</p>
          <Link href="/archive">Return to archive</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const payload = latest.payload;
  const scoreReady = scoreIsDisplayable(latest.bullseye_score, true);

  return <MemberShell active="archive" className="archivePage">
    <div className="memberDashboardShell">
      <section className="archiveHero">
        <div>
          <span>ARCHIVE DAY</span>
          <h1>{date}</h1>
          <p>Detail from stored snapshots for this session only. Engines are not re-run as the original.</p>
        </div>
        <div className="archiveHeroStatus">
          <TerminalBadge label={latest.kind} tone="info" />
          <TerminalBadge label={latest.data_quality} tone={latest.data_quality === "live" ? "positive" : "warning"} />
          <Link href="/archive">All dates</Link>
        </div>
      </section>

      <section className="reviewCompare" aria-label="Stored day summary">
        <div className="reviewGauge">
          <BullseyeGauge
            score={latest.bullseye_score}
            ready={scoreReady}
            posture={latest.posture}
            delayed={latest.data_quality !== "live"}
            compact
          />
        </div>
        <div className="reviewCompareCopy">
          <span>STORED SNAPSHOT</span>
          <h2>{(latest.posture ?? "Unavailable").replaceAll("_", " ")}</h2>
          <dl>
            <div><dt>Score</dt><dd>{formatScoreDisplay(latest.bullseye_score, scoreReady)}</dd></div>
            <div><dt>Risk</dt><dd>{latest.risk_rating ?? "—"}</dd></div>
            <div><dt>Permission</dt><dd>{latest.trade_permission ?? "—"}</dd></div>
            <div><dt>Volatility</dt><dd>{latest.volatility_regime ?? "—"}</dd></div>
            <div><dt>Bias</dt><dd>{payload.decision.marketBias}</dd></div>
            <div><dt>As of</dt><dd>{formatLondon(payload.market.asOf)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="archiveDetailGrid">
        <DashboardCard eyebrow="CONFIRMATIONS" title="Required confirmations" className="archiveDetailCard">
          {payload.plan.requiredConfirmations.length
            ? <ul>{payload.plan.requiredConfirmations.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>None stored on this snapshot.</p>}
        </DashboardCard>
        <DashboardCard eyebrow="INVALIDATION" title="Invalidation conditions" className="archiveDetailCard">
          {payload.decision.invalidationConditions.length
            ? <ul>{payload.decision.invalidationConditions.map((item) => <li key={`${item.kind}-${item.level ?? item.threshold ?? ""}`}>{item.kind}{item.level ? ` · ${item.level}` : ""}{item.threshold != null ? ` · threshold ${item.threshold}` : ""}</li>)}</ul>
            : <p>None stored on this snapshot.</p>}
        </DashboardCard>
        <DashboardCard eyebrow="TIMELINE" title="Known snapshot timestamps" className="archiveDetailCard">
          <ol className="archiveTimeline">
            {dayRows.map((row) => (
              <li key={row.id}>
                <strong>{formatLondon(row.created_at)}</strong>
                <span>{row.kind} · {row.data_quality} · provider {row.provider_health}</span>
              </li>
            ))}
          </ol>
        </DashboardCard>
        <DashboardCard eyebrow="LEVELS" title="Stored levels" className="archiveDetailCard">
          {payload.market.levels.length
            ? <ul>{payload.market.levels.map((level) => <li key={`${level.label}-${level.value}`}><strong>{level.label}</strong> — {level.value}</li>)}</ul>
            : <p>No levels were stored.</p>}
        </DashboardCard>
      </section>
    </div>
  </MemberShell>;
}
