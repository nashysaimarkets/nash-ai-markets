import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "../components/MemberShell";
import { journalPerformance } from "../lib/journal-performance";
import { listAnalysisSnapshots } from "../lib/server/market-snapshots";
import { requireMemberPage } from "../lib/server/member-page-access";
import { listJournalEntries } from "../lib/server/trade-journal";
import { weeklyProcessReview } from "../lib/weekly-process-review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review | NASH AI Markets",
  description: "Review preserved session briefs and private journal records without reconstructed history.",
  robots: { index: false, follow: false },
};

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : value;
}

export default async function ReviewPage() {
  const { user, access } = await requireMemberPage();
  if (!access.features["yesterday-review"]) redirect("/terminal");
  const [snapshots, journal] = await Promise.all([
    listAnalysisSnapshots(12),
    listJournalEntries(user.id),
  ]);
  const performance = journalPerformance(journal.rows);
  const weekly = weeklyProcessReview(journal.rows);
  const latestSnapshots = snapshots.rows.slice(0, 6);
  const latestJournal = journal.rows.slice(0, 5);

  return (
    <MemberShell active="review" className="focusedMemberPage">
      <div className="focusedMemberShell">
        <header className="focusedMemberHero">
          <div>
            <span>Review · Process accountability</span>
            <h1>Judge the process.<br /><em>Not the hindsight.</em></h1>
            <p>
              Compare preserved pre-session evidence with your own private journal.
              Missing history stays missing and small samples never become performance claims.
            </p>
          </div>
          <Link href="/journal">Record a decision →</Link>
        </header>

        <section className="reviewSummary" aria-label="Review record status">
          <article>
            <span>Preserved briefs</span>
            <strong>{snapshots.available ? snapshots.rows.length : "Unavailable"}</strong>
            <small>{snapshots.available ? "Latest records loaded" : "Evidence store could not be read"}</small>
          </article>
          <article>
            <span>Private journal entries</span>
            <strong>{journal.available ? journal.rows.length : "Unavailable"}</strong>
            <small>{journal.available ? "Only your records" : "Journal store could not be read"}</small>
          </article>
          <article>
            <span>Performance sample</span>
            <strong>{performance.sampleSize}</strong>
            <small>{performance.sufficient ? "Closed entries with P&L" : "Percentages remain withheld"}</small>
          </article>
        </section>

        <section className="reviewColumns">
          <article>
            <header>
              <div><span>01 / Preserved briefs</span><h2>What was known beforehand</h2></div>
              <Link href="/archive">Open archive</Link>
            </header>
            {!snapshots.available ? (
              <div className="reviewEmpty"><strong>Evidence store unavailable</strong><p>No history has been reconstructed.</p></div>
            ) : latestSnapshots.length ? (
              <ul className="reviewRecordList">
                {latestSnapshots.map((snapshot) => (
                  <li key={snapshot.id}>
                    <div><strong>{shortDate(snapshot.session_date)}</strong><span>{snapshot.kind.replaceAll("_", " ")}</span></div>
                    <div><span>{snapshot.data_quality}</span><b>{snapshot.posture ?? "Posture unavailable"}</b></div>
                    <small>{snapshot.trade_permission ?? "Permission unavailable"} · {snapshot.risk_rating ?? "Risk unavailable"}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="reviewEmpty"><strong>No preserved briefs yet</strong><p>The review stays empty until a verified snapshot is stored.</p></div>
            )}
          </article>

          <article>
            <header>
              <div><span>02 / Private journal</span><h2>What you decided</h2></div>
              <Link href="/journal">Open journal</Link>
            </header>
            {!journal.available ? (
              <div className="reviewEmpty"><strong>Journal unavailable</strong><p>Your private records could not be read.</p></div>
            ) : latestJournal.length ? (
              <ul className="reviewRecordList">
                {latestJournal.map((entry) => (
                  <li key={entry.id}>
                    <div><strong>{shortDate(entry.traded_at)}</strong><span>{entry.underlying}</span></div>
                    <div><span>{entry.direction}</span><b>{entry.followed_plan === true ? "Plan followed" : entry.followed_plan === false ? "Plan not followed" : "Plan status not recorded"}</b></div>
                    <small>{entry.respected_confirmation === true ? "Confirmation respected" : "Confirmation not verified"} · {entry.respected_invalidation === true ? "Invalidation respected" : "Invalidation not verified"}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="reviewEmpty"><strong>No journal entries yet</strong><p>Record a trade or stand-aside decision to begin the learning loop.</p></div>
            )}
          </article>
        </section>

        <section className="weeklyProcessReview" aria-labelledby="weekly-process-title">
          <header>
            <div>
              <span>03 / This week</span>
              <h2 id="weekly-process-title">A process review, not a performance claim.</h2>
            </div>
            <small>{shortDate(weekly.weekStart)} – {shortDate(weekly.weekEnd)}</small>
          </header>
          <div className="weeklyProcessGrid">
            <article><span>Decisions recorded</span><strong>{weekly.decisions}</strong><small>{weekly.directional} directional · {weekly.standAside} stand aside</small></article>
            <article><span>Plan followed</span><strong>{weekly.plan.respected} / {weekly.plan.recorded}</strong><small>Only explicitly recorded answers</small></article>
            <article><span>Confirmation respected</span><strong>{weekly.confirmation.respected} / {weekly.confirmation.recorded}</strong><small>Unrecorded decisions are not assumed</small></article>
            <article><span>Invalidation respected</span><strong>{weekly.invalidation.respected} / {weekly.invalidation.recorded}</strong><small>Process evidence only</small></article>
          </div>
          <footer><span>Next process focus</span><strong>{weekly.focus}</strong></footer>
        </section>

        <section className="reviewPerformance" aria-labelledby="review-performance-title">
          <div>
            <span>04 / Closed-trade sample</span>
            <h2 id="review-performance-title">Performance without theatre.</h2>
          </div>
          {!performance.sufficient ? (
            <div className="reviewSampleLock" role="status">
              <strong>Percentages withheld</strong>
              <p>{performance.message}</p>
              <span>{performance.sampleSize} / 5 qualifying records</span>
            </div>
          ) : (
            <dl>
              <div><dt>Win rate</dt><dd>{Math.round(performance.winRate * 100)}%</dd></div>
              <div><dt>Plan followed</dt><dd>{performance.planFollowed} / {performance.sampleSize}</dd></div>
              <div><dt>Average win</dt><dd>{performance.averageWin.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</dd></div>
              <div><dt>Average loss</dt><dd>{performance.averageLoss.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</dd></div>
            </dl>
          )}
        </section>

        <footer className="focusedDisclosure">
          <strong>Private and evidence-led</strong>
          <span>Journal entries belong to the signed-in member. Market history comes only from immutable stored snapshots.</span>
        </footer>
      </div>
    </MemberShell>
  );
}
