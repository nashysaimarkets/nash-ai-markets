import type { Metadata } from "next";
import Link from "next/link";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { listAnalysisSnapshots } from "../lib/server/market-snapshots.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import type { StoredAnalysisSnapshot } from "../lib/market-analysis-snapshot.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Historical Archive | NASH AI Markets",
  description: "Browse stored Bullseye analysis snapshots by session date.",
  robots: { index: false, follow: false },
};

function archiveBadge(row: StoredAnalysisSnapshot): { label: string; tone: "positive" | "info" | "warning" | "danger" } {
  if (row.data_quality === "unavailable") return { label: "No historical snapshot", tone: "danger" };
  if (row.provider_health === "degraded" || row.provider_health === "offline" || row.provider_health === "not_configured") {
    return { label: "Provider degraded", tone: "warning" };
  }
  if (row.data_quality === "live" && row.provider_health === "connected") return { label: "Complete", tone: "positive" };
  return { label: "Partial", tone: "info" };
}

function latestPerDate(rows: StoredAnalysisSnapshot[]) {
  const map = new Map<string, StoredAnalysisSnapshot>();
  for (const row of rows) {
    if (!map.has(row.session_date)) map.set(row.session_date, row);
  }
  return [...map.values()];
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ posture?: string; risk?: string }>;
}) {
  const { access, previewState } = await requireMemberPage();
  const filters = await searchParams;

  if (!access.features.archive) {
    return <MemberShell active="archive" className="archivePage">
      <div className="memberDashboardShell">
        <section className="archiveHero">
          <div>
            <span>HISTORICAL ARCHIVE</span>
            <h1>Stored session history</h1>
            <p>Browse verified Bullseye snapshots once your plan includes archive access.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="pro"
          title="Unlock the historical archive"
          value="Pro and Elite members can browse stored analysis snapshots with honest Complete, Partial and unavailable badges."
          benefits={["Session-date cards", "Stored posture and risk only", "No invented history"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const listing = await listAnalysisSnapshots(90);
  if (!listing.available) {
    return <MemberShell active="archive" className="archivePage">
      <div className="memberDashboardShell">
        <section className="archiveHero">
          <div>
            <span>HISTORICAL ARCHIVE</span>
            <h1>Archive migration pending</h1>
            <p>Snapshot storage is not readable yet. No fabricated day cards are shown.</p>
          </div>
        </section>
        <SafeState title="market_analysis_snapshots unavailable" tone="warning">
          <p>Apply the archive migration to begin recording. Until then, Bullseye withholds historical lists rather than inventing them.</p>
          <Link href="/methodology">Methodology limits</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  let days = latestPerDate(listing.rows);
  if (filters.posture) days = days.filter((row) => row.posture === filters.posture);
  if (filters.risk) days = days.filter((row) => row.risk_rating === filters.risk);

  const postures = [...new Set(listing.rows.map((row) => row.posture).filter(Boolean))] as string[];
  const risks = [...new Set(listing.rows.map((row) => row.risk_rating).filter(Boolean))] as string[];

  return <MemberShell active="archive" className="archivePage">
    <div className="memberDashboardShell">
      <section className="archiveHero">
        <div>
          <span>HISTORICAL ARCHIVE</span>
          <h1>Session archive</h1>
          <p>Day cards from stored analysis snapshots only. Filters use recorded posture and risk fields.</p>
        </div>
        <div className="archiveHeroStatus">
          <TerminalBadge label={`${days.length} day${days.length === 1 ? "" : "s"}`} tone="info" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      <form className="archiveFilters" method="get">
        <label>
          Posture
          <select name="posture" defaultValue={filters.posture ?? ""}>
            <option value="">All postures</option>
            {postures.map((posture) => <option key={posture} value={posture}>{posture.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>
          Risk
          <select name="risk" defaultValue={filters.risk ?? ""}>
            <option value="">All risk ratings</option>
            {risks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {!days.length ? (
        <SafeState title="No stored sessions match this view">
          <p>Adjust filters or wait for live sessions to persist snapshots. Bullseye does not invent archive days.</p>
        </SafeState>
      ) : (
        <section className="archiveDayGrid" aria-label="Archived session dates">
          {days.map((row) => {
            const badge = archiveBadge(row);
            return <Link key={row.session_date} href={`/archive/${row.session_date}`} className="archiveDayCard">
              <header>
                <span>{row.session_date}</span>
                <TerminalBadge label={badge.label} tone={badge.tone} />
              </header>
              <strong>{(row.posture ?? "Unavailable").replaceAll("_", " ")}</strong>
              <dl>
                <div><dt>Score</dt><dd>{row.bullseye_score ?? "—"}</dd></div>
                <div><dt>Risk</dt><dd>{row.risk_rating ?? "—"}</dd></div>
                <div><dt>Permission</dt><dd>{row.trade_permission ?? "—"}</dd></div>
                <div><dt>Quality</dt><dd>{row.data_quality}</dd></div>
              </dl>
            </Link>;
          })}
        </section>
      )}
    </div>
  </MemberShell>;
}
