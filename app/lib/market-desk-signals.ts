import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import { isDecisionReadySnapshot, type MarketQuote, type MarketSnapshot } from "./market-data.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";

export type DeskSignalStrength = "strong" | "moderate" | "soft" | "none";
export type DeskSignalStatus = "active" | "watching" | "inactive" | "unavailable";
export type DeskOverallLean = "buying" | "selling" | "mixed" | "neutral" | "insufficient";

export type DeskDirectionalSignal = {
  side: "buying" | "selling";
  strength: DeskSignalStrength;
  status: DeskSignalStatus;
  headline: string;
  summary: string;
  drivers: string[];
  watchingFor: string;
};

export type DeskCandleContext = {
  aboveEma20: boolean | null;
  rangePositionPct: number | null;
  sessionChangePositive: boolean | null;
};

export type MarketDeskSignals = {
  schemaVersion: "1.0";
  overallLean: DeskOverallLean;
  buying: DeskDirectionalSignal;
  selling: DeskDirectionalSignal;
  contextNotes: string[];
  disclosure: string;
};

const DISCLOSURE =
  "Interpretive educational desk signals derived from verified market snapshot inputs. Not trade advice, not broker execution signals, and not executable orders.";

function quote(snapshot: MarketSnapshot, symbol: string): MarketQuote | undefined {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

function equityDirectionPoints(es: MarketQuote | undefined): number {
  if (!es) return 0;
  if (es.direction === "up") return 1;
  if (es.direction === "down") return -1;
  return 0;
}

function riskAppetitePoints(quote: MarketQuote | undefined, inverted: boolean): number {
  if (!quote) return 0;
  if (quote.direction === "flat") return 0;
  const supportive = inverted ? quote.direction === "down" : quote.direction === "up";
  return supportive ? 1 : -1;
}

function clampScore(value: number): number {
  return Math.max(-4, Math.min(4, value));
}

function strengthFromMagnitude(magnitude: number): DeskSignalStrength {
  if (magnitude >= 3) return "strong";
  if (magnitude >= 2) return "moderate";
  if (magnitude >= 1) return "soft";
  return "none";
}

function buildDrivers(input: {
  score: number;
  es?: MarketQuote;
  vix?: MarketQuote;
  dxy?: MarketQuote;
  two?: MarketQuote;
  ten?: MarketQuote;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  candle?: DeskCandleContext | null;
  side: "buying" | "selling";
}): string[] {
  const drivers: string[] = [];
  const favors = input.side === "buying";

  if (input.es) {
    if (favors && input.es.direction === "up") drivers.push(`ES futures latest move is higher (${input.es.change}).`);
    if (!favors && input.es.direction === "down") drivers.push(`ES futures latest move is lower (${input.es.change}).`);
  }

  if (favors && input.intelligence.scores.trend >= 60) {
    drivers.push(`Trend evidence scores ${input.intelligence.scores.trend}/100.`);
  }
  if (!favors && input.intelligence.scores.trend <= 40) {
    drivers.push(`Trend evidence scores ${input.intelligence.scores.trend}/100.`);
  }

  if (input.vix) {
    if (favors && input.vix.direction === "down") drivers.push(`VIX is lower (${input.vix.change}), easing risk pressure.`);
    if (!favors && input.vix.direction === "up") drivers.push(`VIX is higher (${input.vix.change}), adding risk pressure.`);
  }

  if (input.dxy) {
    if (favors && input.dxy.direction === "down") drivers.push(`Dollar is softer (${input.dxy.change}).`);
    if (!favors && input.dxy.direction === "up") drivers.push(`Dollar is firmer (${input.dxy.change}).`);
  }

  const yieldsFalling = [input.two?.direction, input.ten?.direction].filter((direction) => direction === "down").length;
  const yieldsRising = [input.two?.direction, input.ten?.direction].filter((direction) => direction === "up").length;
  if (favors && yieldsFalling > yieldsRising && yieldsFalling > 0) {
    drivers.push("Treasury yields are lower on the verified scalar feed.");
  }
  if (!favors && yieldsRising > yieldsFalling && yieldsRising > 0) {
    drivers.push("Treasury yields are higher on the verified scalar feed.");
  }

  if (favors && (input.decision.marketBias === "bullish" || input.plan.directionalPosture === "long-bias")) {
    drivers.push(`Decision posture reads ${input.plan.directionalPosture.replaceAll("-", " ")} with ${input.decision.marketBias} bias.`);
  }
  if (!favors && (input.decision.marketBias === "bearish" || input.plan.directionalPosture === "short-bias")) {
    drivers.push(`Decision posture reads ${input.plan.directionalPosture.replaceAll("-", " ")} with ${input.decision.marketBias} bias.`);
  }

  if (input.candle) {
    if (favors && input.candle.aboveEma20 === true) drivers.push("Verified ES close sits above the rolling EMA 20.");
    if (!favors && input.candle.aboveEma20 === false) drivers.push("Verified ES close sits below the rolling EMA 20.");
    if (favors && input.candle.sessionChangePositive === true) drivers.push("Rolling 24-hour verified close is above the window's first close.");
    if (!favors && input.candle.sessionChangePositive === false) drivers.push("Rolling 24-hour verified close is below the window's first close.");
    if (favors && input.candle.rangePositionPct != null && input.candle.rangePositionPct >= 65) {
      drivers.push(`Price holds in the upper third of the verified 24-hour range (${Math.round(input.candle.rangePositionPct)}%).`);
    }
    if (!favors && input.candle.rangePositionPct != null && input.candle.rangePositionPct <= 35) {
      drivers.push(`Price holds in the lower third of the verified 24-hour range (${Math.round(input.candle.rangePositionPct)}%).`);
    }
  }

  if (!drivers.length) {
    drivers.push(favors
      ? "No verified inputs currently align with a buying lean."
      : "No verified inputs currently align with a selling lean.");
  }
  return drivers.slice(0, 4);
}

function watchingCopy(
  side: "buying" | "selling",
  intelligence: MarketIntelligence,
  decisionReady: boolean,
): string {
  if (!decisionReady) return "Await verified live or delayed snapshot inputs before treating either lean as active.";
  const bullish = intelligence.scenarios.find((scenario) => scenario.type === "BULLISH");
  const bearish = intelligence.scenarios.find((scenario) => scenario.type === "BEARISH");
  if (side === "buying") {
    return bullish?.trigger.level
      ? `Watching bullish confirmation above ${bullish.trigger.level} on verified ES evidence.`
      : "Watching for verified upside confirmation on ES before treating buying lean as active.";
  }
  return bearish?.trigger.level
    ? `Watching bearish confirmation below ${bearish.trigger.level} on verified ES evidence.`
    : "Watching for verified downside confirmation on ES before treating selling lean as active.";
}

function directionalSignal(input: {
  side: "buying" | "selling";
  score: number;
  overallLean: DeskOverallLean;
  drivers: string[];
  watchingFor: string;
}): DeskDirectionalSignal {
  const magnitude = Math.abs(input.score);
  const favorsSide = input.side === "buying" ? input.score > 0 : input.score < 0;
  const strength = favorsSide ? strengthFromMagnitude(magnitude) : "none";

  if (input.overallLean === "insufficient") {
    return {
      side: input.side,
      strength: "none",
      status: "unavailable",
      headline: input.side === "buying" ? "Buying signal unavailable" : "Selling signal unavailable",
      summary: "Verified snapshot inputs are incomplete, so no directional desk lean is shown.",
      drivers: ["Insufficient verified market data."],
      watchingFor: input.watchingFor,
    };
  }

  if (favorsSide && strength !== "none") {
    const active = input.overallLean === input.side || (input.overallLean === "mixed" && magnitude >= 2);
    return {
      side: input.side,
      strength,
      status: active ? "active" : "watching",
      headline: input.side === "buying"
        ? `${strength === "strong" ? "Strong" : strength === "moderate" ? "Moderate" : "Soft"} buying lean`
        : `${strength === "strong" ? "Strong" : strength === "moderate" ? "Moderate" : "Soft"} selling lean`,
      summary: active
        ? `Verified cross-asset inputs currently lean toward an educational ${input.side} interpretation.`
        : `Some verified inputs lean ${input.side}, but confirmation is still required before treating it as the desk lean.`,
      drivers: input.drivers,
      watchingFor: input.watchingFor,
    };
  }

  if (input.overallLean === "mixed") {
    return {
      side: input.side,
      strength: "soft",
      status: "watching",
      headline: input.side === "buying" ? "Buying path watching" : "Selling path watching",
      summary: "Cross-asset evidence is mixed; both paths stay educational and confirmation-gated.",
      drivers: input.drivers,
      watchingFor: input.watchingFor,
    };
  }

  return {
    side: input.side,
    strength: "none",
    status: "inactive",
    headline: input.side === "buying" ? "Buying lean inactive" : "Selling lean inactive",
    summary: input.side === "buying"
      ? "Verified inputs do not currently support an educational buying lean."
      : "Verified inputs do not currently support an educational selling lean.",
    drivers: input.drivers,
    watchingFor: input.watchingFor,
  };
}

/**
 * Deterministic buying/selling desk signals from verified snapshot + decision context.
 * Fail-closed when data is thin. Never invents prices, strikes, premiums, or Greeks.
 */
export function createMarketDeskSignals(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  candle?: DeskCandleContext | null;
}): MarketDeskSignals {
  const { snapshot, intelligence, decision, plan, candle = null } = input;
  const decisionReady = isDecisionReadySnapshot(snapshot);
  const es = quote(snapshot, "ES");
  const vix = quote(snapshot, "VIX");
  const dxy = quote(snapshot, "DXY");
  const two = quote(snapshot, "US2Y");
  const ten = quote(snapshot, "US10Y");
  const contextNotes: string[] = [];

  if (!decisionReady || !es) {
    const unavailable = directionalSignal({
      side: "buying",
      score: 0,
      overallLean: "insufficient",
      drivers: ["Insufficient verified market data."],
      watchingFor: watchingCopy("buying", intelligence, false),
    });
    return {
      schemaVersion: "1.0",
      overallLean: "insufficient",
      buying: unavailable,
      selling: {
        ...directionalSignal({
          side: "selling",
          score: 0,
          overallLean: "insufficient",
          drivers: ["Insufficient verified market data."],
          watchingFor: watchingCopy("selling", intelligence, false),
        }),
      },
      contextNotes: [
        !decisionReady
          ? "Snapshot is outside the live/delayed decision window."
          : "ES futures quote is missing from the verified snapshot.",
      ],
      disclosure: DISCLOSURE,
    };
  }

  let score = 0;
  score += equityDirectionPoints(es);
  score += intelligence.scores.trend >= 60 ? 1 : intelligence.scores.trend <= 40 ? -1 : 0;
  score += riskAppetitePoints(vix, true);
  score += riskAppetitePoints(dxy, true);
  const treasury = riskAppetitePoints(two, true) + riskAppetitePoints(ten, true);
  if (treasury > 0) score += 1;
  else if (treasury < 0) score -= 1;

  if (decision.marketBias === "bullish" || plan.directionalPosture === "long-bias") score += 1;
  if (decision.marketBias === "bearish" || plan.directionalPosture === "short-bias") score -= 1;
  if (plan.directionalPosture === "stand-aside" || decision.tradePermission === "no-trade") {
    contextNotes.push("Participation remains stand-aside until confirmations clear; signals stay educational only.");
  }

  if (candle?.aboveEma20 === true) score += 1;
  if (candle?.aboveEma20 === false) score -= 1;
  if (candle?.sessionChangePositive === true) score += 1;
  if (candle?.sessionChangePositive === false) score -= 1;
  if (candle?.rangePositionPct != null) {
    if (candle.rangePositionPct >= 65) score += 1;
    else if (candle.rangePositionPct <= 35) score -= 1;
  } else {
    contextNotes.push("Verified candle structure not attached; lean uses quotes and decision scores only.");
  }

  if (snapshot.events.some((event) => event.risk === "HIGH")) {
    contextNotes.push("High-impact calendar events are nearby — treat leans as context, not timing cues.");
  }

  score = clampScore(score);
  const magnitude = Math.abs(score);
  let overallLean: DeskOverallLean = "neutral";
  if (magnitude === 0) overallLean = "neutral";
  else if (score >= 2) overallLean = "buying";
  else if (score <= -2) overallLean = "selling";
  else overallLean = "mixed";

  if (decision.tradePermission === "no-trade" && overallLean !== "neutral") {
    contextNotes.push("No-trade permission is active, so the desk lean stays watching rather than actionable.");
  }

  const shared = { es, vix, dxy, two, ten, intelligence, decision, plan, candle };
  const buyingDrivers = buildDrivers({ ...shared, score, side: "buying" });
  const sellingDrivers = buildDrivers({ ...shared, score, side: "selling" });

  return {
    schemaVersion: "1.0",
    overallLean,
    buying: directionalSignal({
      side: "buying",
      score,
      overallLean,
      drivers: buyingDrivers,
      watchingFor: watchingCopy("buying", intelligence, true),
    }),
    selling: directionalSignal({
      side: "selling",
      score,
      overallLean,
      drivers: sellingDrivers,
      watchingFor: watchingCopy("selling", intelligence, true),
    }),
    contextNotes,
    disclosure: DISCLOSURE,
  };
}

/** Build optional candle context from verified range lane / session stats — never invents levels. */
export function deskCandleContextFromRange(input: {
  current: number;
  high: number;
  low: number;
  firstClose: number | null;
  ema20: number | null;
} | null | undefined): DeskCandleContext | null {
  if (!input || !(input.high > input.low) || !Number.isFinite(input.current)) return null;
  const rangePositionPct = ((input.current - input.low) / (input.high - input.low)) * 100;
  return {
    aboveEma20: input.ema20 != null && Number.isFinite(input.ema20) ? input.current >= input.ema20 : null,
    rangePositionPct: Number.isFinite(rangePositionPct) ? Math.max(0, Math.min(100, rangePositionPct)) : null,
    sessionChangePositive: input.firstClose != null && Number.isFinite(input.firstClose)
      ? input.current >= input.firstClose
      : null,
  };
}
