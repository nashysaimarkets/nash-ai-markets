import Link from "next/link";
import { Sparkline } from "../mini-visuals/Sparkline.tsx";
import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { MarketGatewayStatus } from "../../lib/live-market-gateway.ts";
import { diffSnapshots, METHODOLOGY_VERSION, type AnalysisSnapshotPayload } from "../../lib/market-analysis-snapshot.ts";
import type { MarketDeskSignals } from "../../lib/market-desk-signals.ts";

type Props = {
  name: string;
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  gateway: MarketGatewayStatus;
  decisionReady: boolean;
  score: number | null;
  delayed: boolean;
  dataAge: string;
  esSparkline?: number[] | null;
  previousPayload?: AnalysisSnapshotPayload | null;
  bullishConfirm: string;
  bearishConfirm: string;
  invalidation: string;
  noTrade: string[];
  deskSignals?: MarketDeskSignals | null;
};

const ACTIONS = [
  { href: "/terminal", title: "Open Terminal", description: "Candles, paths and confirmations", icon: "◎" },
  { href: "/brief", title: "Read Market Brief", description: "Plain-English decision summary", icon: "☰" },
  { href: "/review", title: "Review Previous Session", description: "Compare what changed overnight", icon: "↺" },
  { href: "/journal", title: "Trade Journal", description: "Capture disciplined notes", icon: "✎" },
  { href: "/archive", title: "Archive", description: "Immutable daily snapshots", icon: "▣" },
] as const;

export function MissionControl({
  name,
  snapshot,
  intelligence,
  decision,
  plan,
  gateway,
  decisionReady,
  score: _score,
  delayed,
  dataAge,
  esSparkline = null,
  previousPayload = null,
  bullishConfirm,
  bearishConfirm,
  invalidation: _invalidation,
  noTrade,
  deskSignals: _deskSignals = null,
}: Props) {
  const changed = diffSnapshots(previousPayload, {
    version: METHODOLOGY_VERSION,
    generatedAt: snapshot.asOf,
    sessionDate: snapshot.asOf.slice(0, 10),
    kind: "refresh",
    market: {
      status: snapshot.status,
      asOf: snapshot.asOf,
      source: snapshot.source,
      quotes: snapshot.quotes,
      levels: snapshot.levels,
      events: snapshot.events,
      evidence: snapshot.evidence,
    },
    scores: intelligence.scores,
    decision: {
      marketBias: decision.marketBias,
      riskRating: decision.riskRating,
      tradePermission: decision.tradePermission,
      volatilityRegime: decision.volatilityRegime,
      confidenceScore: decision.confidenceScore,
      noTradeReasons: decision.noTradeReasons,
      invalidationConditions: decision.invalidationConditions,
      topSupportingDrivers: decision.topSupportingDrivers,
      conflictingDrivers: decision.conflictingDrivers,
    },
    plan: {
      directionalPosture: plan.directionalPosture,
      executionReadiness: plan.executionReadiness,
      preferredSetupType: plan.preferredSetupType,
      participationLevel: plan.participationLevel,
      requiredConfirmations: plan.requiredConfirmations,
      eventRiskWarnings: plan.eventRiskWarnings,
    },
    scenarios: intelligence.scenarios,
    gateway: {
      connectionStatus: gateway.connectionStatus,
      dataAgeMs: gateway.dataAgeMs,
      fallbackActive: gateway.fallbackActive,
    },
    candleRefs: null,
    generationMode: "deterministic",
  });

  return (
    <div className="missionControl">
      {delayed ? (
        <p className="mcFreshnessBanner" role="status">
          <strong>Verified delayed data</strong>
          <span>Snapshot age: {dataAge}. Readings remain educational and fail-closed until fresher confirmation arrives.</span>
        </p>
      ) : null}

      <section className="mcHero" aria-labelledby="mission-control-title">
        {/* Decorative local SVG sized entirely by CSS; next/image would add no
            optimisation for SVG and would fight the watermark layout. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mcHeroWatermark" src="/brand/logo-mark.svg" alt="" aria-hidden="true" />
        <div className="mcHeroCopy">
          <span>Mission Control</span>
          <h1 id="mission-control-title">Good trading day, {name}.</h1>
          <p>Prepare → Plan → Monitor → Review. Verified conditions only — never reconstructed history.</p>
          <dl className="mcHeroMeta">
            <div><dt>Posture</dt><dd>{decisionReady ? plan.directionalPosture.replaceAll("_", " ") : "Awaiting current data"}</dd></div>
            <div><dt>Risk</dt><dd>{decisionReady ? decision.riskRating : "Unrated"}</dd></div>
            <div><dt>Permission</dt><dd>{decisionReady ? decision.tradePermission.replaceAll("-", " ") : "No trade permitted"}</dd></div>
            <div><dt>Snapshot age</dt><dd className="pmValueUpdate">{dataAge}</dd></div>
          </dl>
        </div>
      </section>

      <section className="mcChartStrip" aria-label="Compact verified ES context">
        <div>
          <span>Verified ES context</span>
          <h2>Compact market path</h2>
        </div>
        {esSparkline ? <Sparkline values={esSparkline} tone="neutral" filled label="ES verified closes" height={48} width={280} /> : <p className="mcEmpty">Verified ES sparkline unlocks with Pro/Elite candle access.</p>}
        <Link href="/terminal">Open full Terminal chart</Link>
      </section>

      <section className="mcPaths" aria-label="Main decision paths">
        <article className="is-bull"><span>Bullish path</span><strong>Bullish confirmation above…</strong><p>{bullishConfirm}</p></article>
        <article className="is-bear"><span>Bearish path</span><strong>Bearish confirmation below…</strong><p>{bearishConfirm}</p></article>
        <article className="is-notrade"><span>No-trade</span><strong>No trade permitted when</strong>{noTrade.length ? <ul>{noTrade.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional codes beyond posture.</p>}</article>
      </section>

      <section className="mcChanged" aria-label="What changed since last snapshot">
        <header>
          <span>What changed</span>
          <h2>{changed.hasPrevious ? "Since the previous stored snapshot" : "Awaiting a prior stored snapshot"}</h2>
        </header>
        {!changed.hasPrevious ? (
          <p className="mcEmpty">Accountable change tracking begins after the first immutable snapshot is stored. Current live readings are shown elsewhere — they are not backfilled as history.</p>
        ) : (
          <div className="mcChangedGrid">
            {changed.quotes.filter((q) => q.changed).map((q) => (
              <article key={q.symbol}><span>{q.symbol}</span><strong className="pmValueUpdate">{q.to}</strong><small>{q.from} → {q.to}</small></article>
            ))}
            <article><span>Score</span><strong>{changed.score.to ?? "—"}</strong><small>{changed.score.from ?? "—"} → {changed.score.to ?? "—"}</small></article>
            <article><span>Posture</span><strong>{String(changed.posture.to ?? "—").replaceAll("_", " ")}</strong><small>{String(changed.posture.from ?? "—").replaceAll("_", " ")}</small></article>
            <article><span>Risk</span><strong>{changed.risk.to ?? "—"}</strong><small>{changed.risk.from ?? "—"}</small></article>
            <article><span>Data</span><strong>{changed.dataQuality.to ?? "—"}</strong><small>{changed.provider.to ?? "—"}</small></article>
          </div>
        )}
      </section>

      <nav className="mcActions" aria-label="Primary workflow actions">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="mcActionTile">
            <span aria-hidden="true">{action.icon}</span>
            <strong>{action.title}</strong>
            <small>{action.description}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
