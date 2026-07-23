import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import { formatSnapshotAge, hasDisplayableQuotes, isDecisionReadySnapshot, type MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketGatewayStatus } from "../../lib/live-market-gateway.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import { Sparkline } from "./Sparkline.tsx";
import { VolatilityGauge } from "./VolatilityGauge.tsx";
import { YieldSpreadVisual } from "./YieldSpreadVisual.tsx";
import { DxyPressureVisual } from "./DxyPressureVisual.tsx";
import { positionPercent, type RangeLaneMarkers } from "./mini-visual-data.ts";

type Props = {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  gatewayStatus: MarketGatewayStatus;
  esSparkline?: number[] | null;
  rangeLane?: RangeLaneMarkers | null;
};

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
  intelligence: _intelligence,
  decision,
  gatewayStatus: _gatewayStatus,
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

  return (
    <section className="ctKeyMarket" aria-labelledby="key-market-title">
      <header>
        <div>
          <span>Today&apos;s key market information</span>
          <h2 id="key-market-title">The conditions that matter most before participation.</h2>
        </div>
        <small>{observable ? `${ready ? "Verified" : "Waiting for fresh data"} · Snapshot age ${age}` : "Awaiting verified inputs"}</small>
      </header>
      <div className="ctKeyGrid is-four">
        <article className="ctKeyModule is-market">
          <span>Market state</span>
          <div className="ctKeyModuleHead">
            <strong className="pmValueUpdate">{es?.value ?? "Unavailable"}</strong>
            <em className={`ctMove is-${es?.direction ?? "missing"}`}>{es?.change ?? "—"}</em>
          </div>
          {esSparkline ? <Sparkline values={esSparkline} tone={es?.direction ?? "neutral"} filled label="ES verified closes" height={40} width={180} /> : <p className="ctKeyHint">ES history unlocks with Pro chart access.</p>}
          <dl>
            <div><dt>Range position</dt><dd>{rangePct != null ? `${rangePct.toFixed(0)}%` : "—"}</dd></div>
            <div><dt>To 24h high</dt><dd>{toHigh != null ? toHigh.toFixed(2) : "—"}</dd></div>
            <div><dt>To 24h low</dt><dd>{toLow != null ? toLow.toFixed(2) : "—"}</dd></div>
            <div><dt>EMA 20</dt><dd>{emaState}</dd></div>
            <div><dt>Snapshot age</dt><dd>{age}</dd></div>
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
      </div>
    </section>
  );
}
