import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { getLatestSnapshotForDate, listAnalysisSnapshots } from "../lib/server/market-snapshots.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { formatScoreDisplay, scoreIsDisplayable } from "../dashboard/lib/score-display.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bullseye Replay Beta | NASH AI Markets",
  description: "Beta replay of stored Bullseye session plans without invented candle playback.",
  robots: { index: false, follow: false },
};

function formatLondon(iso: string | null | undefined) {
  if (!iso) return "Unavailable";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(ms));
}

export default async function ReplayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { access, previewState } = await requireMemberPage();
  const query = await searchParams;

  if (!access.features.replay) {
    return <MemberShell active="replay" className="replayPage">
      <div className="memberDashboardShell">
        <section className="replayHero">
          <div>
            <span>BULLSEYE REPLAY · BETA</span>
            <h1>Session replay</h1>
            <p>Elite beta for reviewing stored plans on known snapshot timestamps — never invented candles.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="elite"
          title="Unlock Bullseye Replay Beta"
          value="Elite members can inspect stored session plans and known snapshot timelines when complete data exists."
          benefits={["Stored plan panel", "Timestamp timeline", "No invented candle playback"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const listing = await listAnalysisSnapshots(120);
  if (!listing.available) {
    return <MemberShell active="replay" className="replayPage">
      <div className="memberDashboardShell">
        <SafeState title="Replay eligibility unavailable" tone="warning">
          <p>Snapshot storage is not readable yet, so Replay cannot select a session. No candle series is fabricated.</p>
          <Link href="/methodology">Replay methodology</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const dates = [...new Set(listing.rows.map((row) => row.session_date))];
  const selected = query.date && dates.includes(query.date) ? query.date : dates[0] ?? null;
  const dayRows = selected ? listing.rows.filter((row) => row.session_date === selected) : [];
  const latest = selected ? await getLatestSnapshotForDate(selected) : null;
  const complete = Boolean(
    latest
    && latest.data_quality !== "unavailable"
    && latest.provider_health !== "offline"
    && latest.provider_health !== "not_configured",
  );
  const candlesNote = latest?.payload.candleRefs
    && [latest.payload.candleRefs.rangeHigh, latest.payload.candleRefs.rangeLow, latest.payload.candleRefs.latest]
      .some((value) => typeof value === "number" && Number.isFinite(value));

  return <MemberShell active="replay" className="replayPage">
    <div className="memberDashboardShell">
      <section className="replayHero">
        <div>
          <span>BULLSEYE REPLAY · BETA</span>
          <h1>Session replay</h1>
          <p>Inspect stored plans on dates with recorded snapshots. Candle playback uses verified history only when available.</p>
        </div>
        <div className="replayHeroStatus">
          <TerminalBadge label="Beta" tone="warning" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
        </div>
      </section>

      {!dates.length ? (
        <SafeState title="Replay eligibility unavailable">
          <p>No complete snapshot dates are stored yet. Replay waits for verified session records rather than inventing a timeline.</p>
        </SafeState>
      ) : (
        <>
          <form className="replayDateForm" method="get">
            <label>
              Session date
              <select name="date" defaultValue={selected ?? ""}>
                {dates.map((date) => <option key={date} value={date}>{date}</option>)}
              </select>
            </label>
            <button type="submit">Load</button>
          </form>

          {!complete || !latest ? (
            <SafeState title="Complete replay data unavailable" tone="warning">
              <p>This date does not have complete stored analysis suitable for replay. Partial or degraded provider states are shown in Archive instead of inventing candles.</p>
              {selected ? <Link href={`/archive/${selected}`}>Open archive day</Link> : null}
            </SafeState>
          ) : (
            <section className="replayLayout">
              <DashboardCard eyebrow="STORED PLAN" title={`Plan for ${selected}`} className="replayPlan">
                <dl>
                  <div><dt>Score</dt><dd>{formatScoreDisplay(latest.bullseye_score, scoreIsDisplayable(latest.bullseye_score, true))}</dd></div>
                  <div><dt>Posture</dt><dd>{(latest.posture ?? "—").replaceAll("_", " ")}</dd></div>
                  <div><dt>Permission</dt><dd>{latest.trade_permission ?? "—"}</dd></div>
                  <div><dt>Risk</dt><dd>{latest.risk_rating ?? "—"}</dd></div>
                  <div><dt>Participation</dt><dd>{latest.payload.plan.participationLevel}</dd></div>
                  <div><dt>Setup</dt><dd>{latest.payload.plan.preferredSetupType}</dd></div>
                </dl>
                {latest.payload.plan.requiredConfirmations.length ? (
                  <ul>{latest.payload.plan.requiredConfirmations.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : <p>No confirmations stored.</p>}
              </DashboardCard>

              <DashboardCard eyebrow="PLAYBACK" title="Verified candle history" className="replayPlayback">
                {candlesNote ? (
                  <p>Limited candle references are stored on this snapshot (range / latest). Full OHLC playback remains unavailable until a verified history series is attached for {selected}.</p>
                ) : (
                  <SafeState title="Candle playback unavailable" tone="warning">
                    <p>Verified session candles are not stored for this date. Replay will not invent an OHLC series.</p>
                  </SafeState>
                )}
              </DashboardCard>

              <DashboardCard eyebrow="TIMELINE" title="Known snapshot timestamps" className="replayTimelineCard">
                <ol className="archiveTimeline">
                  {dayRows.map((row) => (
                    <li key={row.id}>
                      <strong>{formatLondon(row.created_at)}</strong>
                      <span>{row.kind} · score {row.bullseye_score ?? "—"} · {row.data_quality}</span>
                    </li>
                  ))}
                </ol>
              </DashboardCard>
            </section>
          )}
        </>
      )}
    </div>
  </MemberShell>;
}
