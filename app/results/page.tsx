import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { listAnalysisSnapshots } from "../lib/server/market-snapshots.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Results Centre | NASH AI Markets",
  description: "Foundation aggregates from stored market analysis snapshots — no fabricated accuracy.",
  robots: { index: false, follow: false },
};

export default async function ResultsCentrePage() {
  const { access, previewState } = await requireMemberPage();

  if (!access.features["results-centre"]) {
    return <MemberShell active="results" className="resultsPage">
      <div className="memberDashboardShell">
        <section className="resultsHero">
          <div>
            <span>RESULTS CENTRE</span>
            <h1>Snapshot foundations</h1>
            <p>Elite access to posture distribution and coverage from stored snapshots — never invented hit rates.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="elite"
          title="Unlock Results Centre"
          value="Elite members receive foundation aggregates from market_analysis_snapshots with explicit sample-size honesty."
          benefits={["Posture distribution", "Date coverage", "No fabricated accuracy"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const listing = await listAnalysisSnapshots(200);
  if (!listing.available) {
    return <MemberShell active="results" className="resultsPage">
      <div className="memberDashboardShell">
        <SafeState title="Snapshot recording not available yet" tone="warning">
          <p>Results Centre recording begins once market analysis snapshots can be read. No accuracy figures are shown without stored rows.</p>
          <Link href="/methodology">Results methodology</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  if (!listing.rows.length) {
    return <MemberShell active="results" className="resultsPage">
      <div className="memberDashboardShell">
        <section className="resultsHero">
          <div>
            <span>RESULTS CENTRE</span>
            <h1>Recording begins from this release forward</h1>
            <p>No stored analysis snapshots exist yet. Bullseye will not invent historical accuracy.</p>
          </div>
        </section>
        <SafeState title="Empty foundation">
          <p>As live sessions persist snapshots, Results Centre will show posture distribution, sample size and date coverage only.</p>
          <Link href="/archive">Open archive</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const dates = [...new Set(listing.rows.map((row) => row.session_date))].sort();
  const postureCounts = listing.rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.posture ?? "unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const qualityCounts = listing.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.data_quality] = (acc[row.data_quality] ?? 0) + 1;
    return acc;
  }, {});

  return <MemberShell active="results" className="resultsPage">
    <div className="memberDashboardShell">
      <section className="resultsHero">
        <div>
          <span>RESULTS CENTRE</span>
          <h1>Snapshot foundations</h1>
          <p>Aggregates from stored market_analysis_snapshots only. No hit-rate or predictive accuracy is claimed.</p>
        </div>
        <div className="resultsHeroStatus">
          <TerminalBadge label={`${listing.rows.length} snapshots`} tone="info" />
          <TerminalBadge label={`${dates.length} dates`} tone="positive" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      <section className="resultsMetrics" aria-label="Coverage metrics">
        <article><span>Sample size</span><strong>{listing.rows.length}</strong><small>Stored snapshots</small></article>
        <article><span>Date coverage</span><strong>{dates.length}</strong><small>{dates[0]} → {dates[dates.length - 1]}</small></article>
        <article><span>Accuracy claim</span><strong>None</strong><small>Not computed in this release</small></article>
      </section>

      <section className="resultsGrid">
        <DashboardCard eyebrow="POSTURE" title="Posture distribution" className="resultsCard">
          <ul className="resultsDistribution">
            {Object.entries(postureCounts).map(([posture, count]) => (
              <li key={posture}>
                <strong>{posture.replaceAll("_", " ")}</strong>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard eyebrow="QUALITY" title="Data quality mix" className="resultsCard">
          <ul className="resultsDistribution">
            {Object.entries(qualityCounts).map(([quality, count]) => (
              <li key={quality}>
                <strong>{quality}</strong>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </section>

      <footer className="resultsDisclaimer">
        <strong>Foundation only.</strong>
        <span>Results Centre does not evaluate trade outcomes or forecast skill. <Link href="/methodology">Methodology</Link> · <Link href="/risk-disclaimer">Risk disclosure</Link></span>
      </footer>
    </div>
  </MemberShell>;
}
