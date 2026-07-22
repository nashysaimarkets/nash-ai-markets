import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { BullseyeGauge } from "../components/mini-visuals/BullseyeGauge.tsx";
import { formatScoreDisplay, scoreIsDisplayable } from "../dashboard/lib/score-display.ts";
import { firstCompleteSnapshotDate, getPreviousDaySnapshot, listAnalysisSnapshots } from "../lib/server/market-snapshots.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yesterday's Review | NASH AI Markets",
  description: "Accountable review of the previous session from stored Bullseye snapshots only.",
  robots: { index: false, follow: false },
};

function formatLondon(iso: string | null | undefined) {
  if (!iso) return "Unavailable";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(ms));
}

function hasStoredSessionCandles(candleRefs: {
  rangeHigh: number | null;
  rangeLow: number | null;
  firstClose: number | null;
  latest: number | null;
} | null | undefined) {
  if (!candleRefs) return false;
  return [candleRefs.rangeHigh, candleRefs.rangeLow, candleRefs.firstClose, candleRefs.latest]
    .some((value) => typeof value === "number" && Number.isFinite(value));
}

export default async function YesterdayReviewPage() {
  const { access, previewState } = await requireMemberPage();
  const locked = !access.features["yesterday-review"];

  if (locked) {
    return <MemberShell active="review" className="reviewPage">
      <div className="memberDashboardShell">
        <section className="reviewHero">
          <div>
            <span>YESTERDAY&apos;S REVIEW</span>
            <h1>Accountable session review</h1>
            <p>Stored Bullseye snapshots only — never re-scored as “original” after the fact.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="pro"
          title="Unlock Yesterday’s Review"
          value="Pro and Elite members can review the previous session from verified stored snapshots with honest unavailable states when history is incomplete."
          benefits={["Stored score and posture only", "No invented OHLC comparison", "Fail-closed empty states"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const [previous, firstDate, listing] = await Promise.all([
    getPreviousDaySnapshot(),
    firstCompleteSnapshotDate(),
    listAnalysisSnapshots(5),
  ]);

  if (!listing.available) {
    return <MemberShell active="review" className="reviewPage">
      <div className="memberDashboardShell">
        <section className="reviewHero">
          <div>
            <span>YESTERDAY&apos;S REVIEW</span>
            <h1>Accountable session review</h1>
            <p>Historical snapshots are not readable until the archive migration is applied.</p>
          </div>
        </section>
        <SafeState title="Snapshot archive migration pending" tone="warning">
          <p>Yesterday’s Review will unlock once market analysis snapshots are stored. No invented history is shown in the meantime.</p>
          <Link href="/methodology">Read methodology limits</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  if (!previous) {
    return <MemberShell active="review" className="reviewPage">
      <div className="memberDashboardShell">
        <section className="reviewHero">
          <div>
            <span>YESTERDAY&apos;S REVIEW</span>
            <h1>No previous-day snapshot yet</h1>
            <p>Accountable reviews start once verified Bullseye snapshots accumulate for prior sessions.</p>
          </div>
          <div className="reviewHeroStatus">
            <TerminalBadge label="Awaiting history" tone="info" />
            <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          </div>
        </section>
        <SafeState title="Nothing stored for the previous UTC session">
          <p>Bullseye does not invent a prior plan, score or OHLC print. Recording begins as live sessions persist analysis snapshots.</p>
          {firstDate ? <p>Earliest stored session date on record: <strong>{firstDate}</strong>.</p> : <p>No complete snapshot dates are available yet.</p>}
          <Link href="/archive">Open historical archive</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  const payload = previous.payload;
  const score = previous.bullseye_score;
  const scoreReady = scoreIsDisplayable(score, true);
  const candlesAvailable = hasStoredSessionCandles(payload.candleRefs);
  const scenarios = payload.scenarios ?? [];
  const levels = payload.market.levels ?? [];

  return <MemberShell active="review" className="reviewPage">
    <div className="memberDashboardShell">
      <section className="reviewHero">
        <div>
          <span>YESTERDAY&apos;S REVIEW</span>
          <h1>Session {previous.session_date}</h1>
          <p>Original stored decision only. Engines are not re-run to rewrite yesterday’s score, posture or paths.</p>
        </div>
        <div className="reviewHeroStatus">
          <TerminalBadge label={previous.kind} tone="info" />
          <TerminalBadge label={previous.data_quality} tone={previous.data_quality === "live" ? "positive" : "warning"} />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          <small>Stored {formatLondon(previous.created_at)}</small>
        </div>
      </section>

      <section className="reviewCompare" aria-label="Stored session summary">
        <div className="reviewGauge">
          <BullseyeGauge
            score={score ?? 0}
            ready={scoreReady}
            posture={previous.posture ?? "stand_aside"}
            delayed={previous.data_quality !== "live"}
            compact
          />
        </div>
        <div className="reviewCompareCopy">
          <span>STORED ORIGINAL</span>
          <h2>{(previous.posture ?? "stand aside").replaceAll("_", " ")}</h2>
          <dl>
            <div><dt>Bullseye score</dt><dd>{formatScoreDisplay(score, scoreReady)}</dd></div>
            <div><dt>Risk rating</dt><dd>{previous.risk_rating ?? "Not rated"}</dd></div>
            <div><dt>Trade permission</dt><dd>{previous.trade_permission ?? "Unavailable"}</dd></div>
            <div><dt>Volatility regime</dt><dd>{previous.volatility_regime ?? "Unavailable"}</dd></div>
            <div><dt>Market bias</dt><dd>{payload.decision.marketBias}</dd></div>
            <div><dt>As of</dt><dd>{formatLondon(payload.market.asOf)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="reviewGrid">
        <DashboardCard eyebrow="PATHS" title="Stored directional paths" className="reviewPaths">
          {scenarios.length ? (
            <ul>
              {scenarios.map((scenario) => (
                <li key={scenario.type}>
                  <strong>{scenario.type}</strong>
                  {" — "}stored probability {scenario.probability}
                  {scenario.trigger?.kind ? ` · trigger ${scenario.trigger.kind}${scenario.trigger.level ? ` @ ${scenario.trigger.level}` : ""}` : ""}
                  {scenario.invalidation?.kind ? ` · invalidation ${scenario.invalidation.kind}${scenario.invalidation.level ? ` @ ${scenario.invalidation.level}` : ""}` : ""}
                </li>
              ))}
            </ul>
          ) : <p>No scenario paths were stored for this session.</p>}
        </DashboardCard>

        <DashboardCard eyebrow="NO-TRADE" title="Stored no-trade reasons" className="reviewNoTrade">
          {payload.decision.noTradeReasons.length
            ? <ul>{payload.decision.noTradeReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            : <p>No no-trade reasons were recorded on this snapshot.</p>}
        </DashboardCard>

        <DashboardCard eyebrow="LEVELS" title="Stored market levels" className="reviewLevels">
          {levels.length
            ? <ul>{levels.map((level) => <li key={`${level.label}-${level.value}`}><strong>{level.label}</strong> — {level.value}</li>)}</ul>
            : <p>No verified levels were stored on this snapshot.</p>}
        </DashboardCard>

        <DashboardCard eyebrow="SESSION CANDLES" title="Completed-session OHLC comparison" className="reviewCandles">
          {candlesAvailable ? (
            <dl>
              <div><dt>Range high</dt><dd>{payload.candleRefs?.rangeHigh ?? "—"}</dd></div>
              <div><dt>Range low</dt><dd>{payload.candleRefs?.rangeLow ?? "—"}</dd></div>
              <div><dt>First close</dt><dd>{payload.candleRefs?.firstClose ?? "—"}</dd></div>
              <div><dt>Latest</dt><dd>{payload.candleRefs?.latest ?? "—"}</dd></div>
            </dl>
          ) : (
            <SafeState title="Verified session candles unavailable" tone="warning">
              <p>Completed-session OHLC comparison awaits verified session candles stored for {previous.session_date}. Bullseye will not invent prints to fill this panel.</p>
            </SafeState>
          )}
        </DashboardCard>
      </section>

      <footer className="reviewDisclaimer">
        <strong>Decision support, not financial advice.</strong>
        <span>This review shows the stored snapshot payload only. <Link href="/archive">Archive</Link> · <Link href="/methodology">Methodology</Link> · <Link href="/risk-disclaimer">Risk disclosure</Link></span>
      </footer>
    </div>
  </MemberShell>;
}
