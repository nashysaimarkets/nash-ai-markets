import {
  MARKET_BOARD_LABELS,
  MARKET_BOARD_SYMBOLS,
  isTreasuryScalar,
  type MarketBoardSymbol,
} from "./market-board-instruments.ts";
import { isDecisionReadySnapshot, type MarketQuote, type MarketSnapshot } from "./market-data.ts";
import type { DeskCandleContext, DeskOverallLean, MarketDeskSignals } from "./market-desk-signals.ts";

export type GaugeDirection = "buy" | "sell" | "neutral" | "insufficient";
export type GaugeConfidenceTier = "high" | "moderate" | "low" | "none";

export type InstrumentDirectionalGauge = {
  symbol: MarketBoardSymbol;
  label: string;
  direction: GaugeDirection;
  /** 0–100 when direction is not insufficient; null when data is too thin. */
  confidencePct: number | null;
  confidenceTier: GaugeConfidenceTier;
  summary: string;
  drivers: string[];
  scalarOnly: boolean;
};

export type MarketDirectionalGauges = {
  schemaVersion: "1.0";
  gauges: InstrumentDirectionalGauge[];
  deskLean: DeskOverallLean;
  disclosure: string;
};

const DISCLOSURE =
  "Interpretive educational directional confidence per instrument. Derived from verified quote direction, data quality, and cross-asset agreement — not trade advice and not a probability of profit.";

function quote(snapshot: MarketSnapshot, symbol: string): MarketQuote | undefined {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

function directionFromQuote(item: MarketQuote | undefined): GaugeDirection {
  if (!item) return "insufficient";
  if (item.direction === "up") return "buy";
  if (item.direction === "down") return "sell";
  return "neutral";
}

function invertDirection(direction: GaugeDirection): GaugeDirection {
  if (direction === "buy") return "sell";
  if (direction === "sell") return "buy";
  return direction;
}

/** Risk-on pressure from inverted VIX/DXY + ES: buy = supportive for equities. */
function crossAssetPressure(snapshot: MarketSnapshot): GaugeDirection {
  let score = 0;
  const es = quote(snapshot, "ES");
  const vix = quote(snapshot, "VIX");
  const dxy = quote(snapshot, "DXY");
  if (es?.direction === "up") score += 1;
  if (es?.direction === "down") score -= 1;
  if (vix?.direction === "down") score += 1;
  if (vix?.direction === "up") score -= 1;
  if (dxy?.direction === "down") score += 1;
  if (dxy?.direction === "up") score -= 1;
  if (score >= 2) return "buy";
  if (score <= -2) return "sell";
  if (score === 0) return "neutral";
  return score > 0 ? "buy" : "sell";
}

function qualityBonus(snapshot: MarketSnapshot): number {
  if (snapshot.status === "LIVE") return 18;
  if (snapshot.status === "DELAYED") return 8;
  return 0;
}

function agreementBonus(
  instrumentDirection: GaugeDirection,
  pressure: GaugeDirection,
  inverted: boolean,
): number {
  if (instrumentDirection === "insufficient" || instrumentDirection === "neutral") return 0;
  if (pressure === "neutral" || pressure === "insufficient") return 4;
  const expected = inverted ? invertDirection(pressure) : pressure;
  if (instrumentDirection === expected) return 22;
  if (instrumentDirection === invertDirection(expected)) return -12;
  return 0;
}

function candleBonus(candle: DeskCandleContext | null | undefined, direction: GaugeDirection): number {
  if (!candle || direction === "insufficient" || direction === "neutral") return 0;
  let bonus = 0;
  if (direction === "buy" && candle.aboveEma20 === true) bonus += 8;
  if (direction === "sell" && candle.aboveEma20 === false) bonus += 8;
  if (direction === "buy" && candle.sessionChangePositive === true) bonus += 6;
  if (direction === "sell" && candle.sessionChangePositive === false) bonus += 6;
  if (direction === "buy" && candle.rangePositionPct != null && candle.rangePositionPct >= 65) bonus += 4;
  if (direction === "sell" && candle.rangePositionPct != null && candle.rangePositionPct <= 35) bonus += 4;
  return bonus;
}

function tierFromPct(pct: number | null): GaugeConfidenceTier {
  if (pct == null) return "none";
  if (pct >= 70) return "high";
  if (pct >= 45) return "moderate";
  if (pct >= 20) return "low";
  return "none";
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildInstrumentGauge(input: {
  symbol: MarketBoardSymbol;
  snapshot: MarketSnapshot;
  pressure: GaugeDirection;
  decisionReady: boolean;
  candle?: DeskCandleContext | null;
}): InstrumentDirectionalGauge {
  const { symbol, snapshot, pressure, decisionReady, candle = null } = input;
  const label = MARKET_BOARD_LABELS[symbol];
  const item = quote(snapshot, symbol);
  const scalarOnly = isTreasuryScalar(symbol);

  if (!item || (!decisionReady && snapshot.status !== "LIVE" && snapshot.status !== "DELAYED")) {
    return {
      symbol,
      label,
      direction: "insufficient",
      confidencePct: null,
      confidenceTier: "none",
      summary: `${label} has no verified reading suitable for a directional confidence gauge.`,
      drivers: ["Insufficient verified market data for this instrument."],
      scalarOnly,
    };
  }

  if (scalarOnly) {
    // Treasuries are honest scalars — no session % change and no OHLC.
    const drivers = [
      "Treasury yield is a verified scalar reading without session change direction from the provider.",
      "Directional confidence stays limited until a directional change series is available.",
    ];
    if (pressure === "buy") drivers.push("Cross-asset pressure currently leans risk-on; yields are shown for context only.");
    if (pressure === "sell") drivers.push("Cross-asset pressure currently leans risk-off; yields are shown for context only.");
    return {
      symbol,
      label,
      direction: "neutral",
      confidencePct: clampPct(22 + qualityBonus(snapshot) * 0.35),
      confidenceTier: "low",
      summary: `${label} remains scalar-only. Directional confidence is interpretive context, not a yield-trade signal.`,
      drivers: drivers.slice(0, 4),
      scalarOnly: true,
    };
  }

  const direction = directionFromQuote(item);
  if (direction === "neutral") {
    return {
      symbol,
      label,
      direction: "neutral",
      confidencePct: clampPct(28 + qualityBonus(snapshot) * 0.4),
      confidenceTier: "low",
      summary: `${label} latest verified move is flat (${item.change}). Confidence stays low without a clear directional print.`,
      drivers: [
        `Latest verified change is ${item.change}.`,
        "Flat prints do not support a buy or sell lean for this instrument.",
      ],
      scalarOnly: false,
    };
  }

  const invertedPressure = symbol === "VIX" || symbol === "DXY";
  let confidence = 34 + qualityBonus(snapshot);
  confidence += agreementBonus(direction, pressure, invertedPressure);
  if (symbol === "ES") confidence += candleBonus(candle, direction);
  if (symbol === "OIL" || symbol === "QQQ" || symbol === "NQ") {
    // Equity/ETF/index secondaries: slight lift when ES agrees with their print.
    const esDir = directionFromQuote(quote(snapshot, "ES"));
    if (esDir === direction) confidence += 10;
    else if (esDir === invertDirection(direction)) confidence -= 8;
  }

  const confidencePct = clampPct(confidence);
  const drivers: string[] = [
    `${label} latest verified move is ${item.direction} (${item.change}).`,
  ];
  if (snapshot.status === "LIVE") drivers.push("Snapshot freshness is live within the decision window.");
  else if (snapshot.status === "DELAYED") drivers.push("Snapshot is delayed — confidence is capped accordingly.");
  if (agreementBonus(direction, pressure, invertedPressure) > 10) {
    drivers.push(invertedPressure
      ? "Instrument move agrees with inverted cross-asset pressure."
      : "Instrument move agrees with cross-asset risk pressure.");
  } else if (agreementBonus(direction, pressure, invertedPressure) < 0) {
    drivers.push("Instrument move conflicts with broader cross-asset pressure.");
  }
  if (symbol === "ES" && candle) {
    if (candle.aboveEma20 != null) {
      drivers.push(candle.aboveEma20
        ? "Verified ES close sits above the rolling EMA 20."
        : "Verified ES close sits below the rolling EMA 20.");
    }
  }

  return {
    symbol,
    label,
    direction,
    confidencePct,
    confidenceTier: tierFromPct(confidencePct),
    summary: direction === "buy"
      ? `Educational buying lean for ${label} at ${confidencePct}% interpretive confidence.`
      : `Educational selling lean for ${label} at ${confidencePct}% interpretive confidence.`,
    drivers: drivers.slice(0, 4),
    scalarOnly: false,
  };
}

/**
 * Per-instrument directional confidence gauges for the full market board.
 * Fail-closed when quotes are missing. Never invents prices or certainty.
 */
export function createMarketDirectionalGauges(input: {
  snapshot: MarketSnapshot;
  deskSignals?: MarketDeskSignals | null;
  candle?: DeskCandleContext | null;
}): MarketDirectionalGauges {
  const { snapshot, deskSignals = null, candle = null } = input;
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const pressure = crossAssetPressure(snapshot);

  return {
    schemaVersion: "1.0",
    gauges: MARKET_BOARD_SYMBOLS.map((symbol) => buildInstrumentGauge({
      symbol,
      snapshot,
      pressure,
      decisionReady,
      candle: symbol === "ES" ? candle : null,
    })),
    deskLean: deskSignals?.overallLean ?? "insufficient",
    disclosure: DISCLOSURE,
  };
}
