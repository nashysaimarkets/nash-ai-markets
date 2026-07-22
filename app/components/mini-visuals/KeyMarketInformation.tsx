import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot, type MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketGatewayStatus } from "../../lib/live-market-gateway.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { Sparkline } from "./Sparkline.tsx";
import { VolatilityGauge } from "./VolatilityGauge.tsx";
import { YieldSpreadVisual } from "./YieldSpreadVisual.tsx";
import { DxyPressureVisual } from "./DxyPressureVisual.tsx";
import { positionPercent, type RangeLaneMarkers } from "./mini-visual-data.ts";

type EvidenceState = "available" | "incomplete" | "unavailable" | "degraded";

type Props = {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  gatewayStatus: MarketGatewayStatus;
  esSparkline?: number[] | null;
  rangeLane?: RangeLaneMarkers | null;
};

function evidenceState(value: number | null | undefined, ready: boolean): EvidenceState {
  if (!ready) return "incomplete";
  if (value == null || !Number.isFinite(value)) return "unavailable";
  return "available";
}

function volImplication(regime: string | null, ready: boolean): string {
  if (!ready || !regime) return "Implication withheld";
  if (regime === "compressed" || regime === "normal") return "Supportive for equity risk";
  if (regime === "elevated") return "Neutral / caution for equity risk";
  return "Constraining for equity risk";
}

function curveImplication(spread: number | null): string {
  if (spread == null) return "Curve implication withheld";
  if (spread < 0) return "Inverted curve — caution on growth risk";
  if (spread > 0.35) return "Steeper curve — growth-friendly bias";
  return "Near-flat curve — mixed macro pressure";
}

function dollarImplication(direction: "up" | "down" | "flat" | undefined): string {
  if (!direction) return "Dollar implication withheld";
  if (direction === "up") return "Stronger dollar can constrain risk appetite";
  if (direction === "down") return "Softer dollar can support risk appetite";
  return "Neutral dollar pressure on equities";
}

export function KeyMarketInformation({
  snapshot,
  intelligence,
  decision,
  gatewayStatus,
  esSparkline = null,
  rangeLane = null,
}: Props) {
  const ready = isDecisionReadySnapshot(snapshot);
  const observable = hasDisplayableQuotes(snapshot);
  const age = formatSnapshotAge(snapshot.asOf);
  const find = (symbol: string) => snapshot.quotes.find((item) => item.symbol === symbol);
  const es = find("ES");
  const vix = find("VIX");
  const two = find("US2Y");
  const ten = find("US10Y");
  const dxy = find("DXY");
  const twoN = two?.value ? Number.parseFloat(String(two.value).replaceAll(",", "")) : NaN;
  const tenN = ten?.value ? Number.parseFloat(String(ten.value).replaceAll(",", "")) : NaN;
  const spread = Number.isFinite(twoN) && Number.isFinite(tenN) ? tenN - twoN : null;
  const rangePct = rangeLane ? positionPercent(rangeLane.current, rangeLane.low, rangeLane.high) : null;
  const toHigh = rangeLane ? rangeLane.high - rangeLane.current : null;
  const toLow = rangeLane ? rangeLane.current - rangeLane.low : null;
  const emaState = rangeLane?.ema20 != null
    ? rangeLane.current >= rangeLane.ema20 ? "Above EMA 20" : "Below EMA 20"
    : "EMA 20 unavailable";
  const freshness: EvidenceState = !observable
    ? "unavailable"
    : snapshot.status === "LIVE"
      ? "available"
      : snapshot.status === "DELAYED"
        ? "degraded"
        : "incomplete";
  const provider: EvidenceState = gatewayStatus.connectionStatus === "connected"
    ? "available"
    : gatewayStatus.connectionStatus === "degraded"
      ? "degraded"
      : "unavailable";
  const checklist: Array<{ label: string; state: EvidenceState; tip: string }> = [
    { label: "Trend", state: evidenceState(intelligence.scores.trend, ready), tip: "Verified trend evidence" },
    { label: "Momentum", state: evidenceState(typeof snapshot.evidence.momentum === "number" ? snapshot.evidence.momentum : null, ready), tip: "Verified momentum evidence" },
    { label: "Volatility", state: evidenceState(intelligence.scores.volatility, ready), tip: "Verified volatility regime" },
    { label: "Breadth", state: evidenceState(typeof snapshot.evidence.breadth === "number" ? snapshot.evidence.breadth : null, ready), tip: "Verified breadth evidence" },
    { label: "Macro", state: evidenceState(typeof snapshot.evidence.macro === "number" ? snapshot.evidence.macro : null, ready), tip: "Verified macro evidence" },
    { label: "Support", state: snapshot.levels.some((level) => level.type === "support") ? "available" : "unavailable", tip: "Verified support reference" },
    { label: "Resistance", state: snapshot.levels.some((level) => level.type === "resistance") ? "available" : "unavailable", tip: "Verified resistance reference" },
    { label: "Events", state: snapshot.events.length ? "available" : "unavailable", tip: "Verified economic calendar" },
    { label: "Freshness", state: freshness, tip: `Data age ${age}` },
    { label: "Provider", state: provider, tip: gatewayStatus.connectionStatus },
  ];

  return (
    <section className="ctKeyMarket" aria-labelledby="key-market-title">
      <header>
        <div>
          <span>Today&apos;s key market information</span>
          <h2 id="key-market-title">The conditions that matter most before participation.</h2>
        </div>
        <small>{observable ? `${ready ? "Verified" : "Previous session"} · ${age}` : "Awaiting verified inputs"}</small>
      </header>
      <div className="ctKeyGrid">
        <article className="ctKeyModule is-market">
          <span>Market state</span>
          <div className="ctKeyModuleHead">
            <strong>{es?.value ?? "Unavailable"}</strong>
            <em className={`ctMove is-${es?.direction ?? "missing"}`}>{es?.change ?? "—"}</em>
          </div>
          {esSparkline ? <Sparkline values={esSparkline} tone={es?.direction ?? "neutral"} filled label="ES verified closes" height={40} width={180} /> : <p className="ctKeyHint">ES history unlocks with Pro chart access.</p>}
          <dl>
            <div><dt>Range position</dt><dd>{rangePct != null ? `${rangePct.toFixed(0)}%` : "—"}</dd></div>
            <div><dt>To 24h high</dt><dd>{toHigh != null ? toHigh.toFixed(2) : "—"}</dd></div>
            <div><dt>To 24h low</dt><dd>{toLow != null ? toLow.toFixed(2) : "—"}</dd></div>
            <div><dt>EMA 20</dt><dd>{emaState}</dd></div>
            <div><dt>Data age</dt><dd>{age}</dd></div>
          </dl>
          {rangeLane ? (
            <div className="ctKeyRange" aria-hidden="true">
              <i style={{ height: `${rangePct ?? 0}%` }} />
            </div>
          ) : null}
        </article>

        <article className="ctKeyModule is-vol">
          <span>Volatility</span>
          <div className="ctKeyModuleHead">
            <strong>{vix?.value ?? "Unavailable"}</strong>
            <em className={`ctMove is-${vix?.direction ?? "missing"}`}>{vix?.change ?? "—"}</em>
          </div>
          <VolatilityGauge regime={ready ? decision.volatilityRegime : null} ready={ready} vixValue={vix?.value ?? null} compact />
          <p>{volImplication(decision.volatilityRegime, ready)}</p>
        </article>

        <article className="ctKeyModule is-rates">
          <span>Rates</span>
          <dl className="ctKeyRates">
            <div><dt>US 2Y</dt><dd>{two?.value ?? "—"}</dd></div>
            <div><dt>US 10Y</dt><dd>{ten?.value ?? "—"}</dd></div>
            <div><dt>Spread</dt><dd>{spread != null ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)} pp` : "—"}</dd></div>
          </dl>
          <YieldSpreadVisual twoYear={two?.value} tenYear={ten?.value} ready={Boolean(two && ten)} compact />
          <p>{curveImplication(spread)}</p>
        </article>

        <article className="ctKeyModule is-dollar">
          <span>Dollar pressure</span>
          <div className="ctKeyModuleHead">
            <strong>{dxy?.value ?? "Unavailable"}</strong>
            <em className={`ctMove is-${dxy?.direction ?? "missing"}`}>{dxy?.change ?? "—"}</em>
          </div>
          <DxyPressureVisual direction={dxy?.direction} change={dxy?.change} ready={Boolean(dxy)} compact />
          <p>{dollarImplication(dxy?.direction)}</p>
        </article>

        <article className="ctKeyModule is-ready">
          <span>Decision readiness</span>
          <p className="ctKeyHint">Why Bullseye stays closed or opens — evidence checklist only.</p>
          <ul className="ctEvidenceCheck">
            {checklist.map((item) => (
              <li key={item.label} className={`is-${item.state}`} title={item.tip}>
                <i aria-hidden="true" />
                <strong>{item.label}</strong>
                <span>{item.state}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
