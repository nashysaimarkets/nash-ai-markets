/**
 * ILLUSTRATIVE presentation fixtures for private screenshot / video capture.
 * Never imported by live Dashboard, Brief, Terminal, providers, or decision engines.
 */

export const MARKETING_PREVIEW_STATES = ["wait", "constructive", "defensive", "mixed"] as const;
export type MarketingPreviewStateId = (typeof MARKETING_PREVIEW_STATES)[number];

export type IllustrativeCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IllustrativeLevels = {
  r2: number;
  r1: number;
  pivot: number;
  s1: number;
  s2: number;
  overnightHigh: number;
  overnightLow: number;
  overnightRange: number;
  overnightMidpoint: number;
  expectedMove: number;
  sessionHigh: number;
  sessionLow: number;
  priorClose: number;
};

export type IllustrativePosture = {
  headline: string;
  participation: string;
  lean: string;
  leanTone: "bull" | "bear" | "mixed" | "neutral";
  permissionTone: "blocked" | "caution" | "open";
  confidence: string;
  confidenceDetail: string;
  primaryCondition: string;
  summary: string;
  supporting: string[];
  opposing: string[];
  weather: string;
  weatherDetail: string;
  evidence: string[];
  postureHistory: Array<{ label: string; lean: string }>;
  sessionStatus: string;
};

export type MarketingPreviewFixture = {
  id: MarketingPreviewStateId;
  label: string;
  illustrative: true;
  disclaimer: string;
  banner: string;
  posture: IllustrativePosture;
  candles: IllustrativeCandle[];
  levels: IllustrativeLevels;
  crossMarket: Array<{
    symbol: string;
    label: string;
    change: string;
    tone: "up" | "down" | "flat";
    sparkline: number[];
  }>;
};

export type MarketingPreviewTimeframe = "1m" | "5m" | "15m" | "1H" | "4H";

const TIMEFRAME_SECONDS: Record<MarketingPreviewTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3_600,
  "4H": 14_400,
};

export function aggregateIllustrativeCandles(candles: IllustrativeCandle[], timeframe: MarketingPreviewTimeframe) {
  const seconds = TIMEFRAME_SECONDS[timeframe];
  if (seconds === 60) return candles;
  const buckets = new Map<number, IllustrativeCandle[]>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.time / seconds) * seconds;
    const group = buckets.get(bucket) ?? [];
    group.push(candle);
    buckets.set(bucket, group);
  }
  return [...buckets.entries()].map(([time, group]) => ({
    time,
    open: group[0]!.open,
    high: Math.max(...group.map((candle) => candle.high)),
    low: Math.min(...group.map((candle) => candle.low)),
    close: group.at(-1)!.close,
    volume: group.reduce((sum, candle) => sum + candle.volume, 0),
  }));
}

const BANNER = "ILLUSTRATIVE SESSION SNAPSHOT";
const DISCLAIMER =
  "Illustrative session data for product demonstration. Not live market data and not financial advice.";

/** Fixed session anchor so repeated screenshots stay identical. */
const SESSION_END = Date.UTC(2026, 6, 21, 17, 0, 0) / 1000;
const BAR_SECONDS = 60;
const BAR_COUNT = 390;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCandles(profile: MarketingPreviewStateId): IllustrativeCandle[] {
  let close = 6124.5;
  const candles: IllustrativeCandle[] = [];
  for (let index = 0; index < BAR_COUNT; index += 1) {
    const progress = index / (BAR_COUNT - 1);
    const wave = Math.sin(index / 5.2) * 0.55 + Math.cos(index / 11.4) * 0.28;
    let drift = 0;
    if (profile === "constructive") drift = 0.085 + progress * 0.04;
    else if (profile === "defensive") drift = -0.09 - progress * 0.035;
    else if (profile === "mixed") drift = Math.sin(index / 3.1) * 0.12;
    else drift = (index % 9 === 0 ? 0.04 : index % 7 === 0 ? -0.035 : 0.01) * (1 - progress * 0.35);

    const open = close;
    const next = open + wave * 0.42 + drift;
    close = Math.max(6088, Math.min(6162, next));
    const wick = 0.35 + (index % 5) * 0.08;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick * 0.9;
    candles.push({
      time: SESSION_END - (BAR_COUNT - 1 - index) * BAR_SECONDS,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: 1100 + ((index * 173) % 2400) + (profile === "constructive" || profile === "defensive" ? 400 : 0),
    });
  }
  return candles;
}

function levelsFromCandles(candles: IllustrativeCandle[]): IllustrativeLevels {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const sessionHigh = Math.max(...highs);
  const sessionLow = Math.min(...lows);
  const priorClose = candles[Math.max(0, candles.length - 14)]!.close;
  const overnight = candles.slice(0, 18);
  const overnightHigh = Math.max(...overnight.map((c) => c.high));
  const overnightLow = Math.min(...overnight.map((c) => c.low));
  const overnightRange = round2(overnightHigh - overnightLow);
  const overnightMidpoint = round2((overnightHigh + overnightLow) / 2);
  const pivot = round2((sessionHigh + sessionLow + candles.at(-1)!.close) / 3);
  const r1 = round2(2 * pivot - sessionLow);
  const s1 = round2(2 * pivot - sessionHigh);
  const r2 = round2(pivot + (sessionHigh - sessionLow));
  const s2 = round2(pivot - (sessionHigh - sessionLow));
  const expectedMove = round2((sessionHigh - sessionLow) * 0.42);
  return {
    r2,
    r1,
    pivot,
    s1,
    s2,
    overnightHigh: round2(overnightHigh),
    overnightLow: round2(overnightLow),
    overnightRange,
    overnightMidpoint,
    expectedMove,
    sessionHigh: round2(sessionHigh),
    sessionLow: round2(sessionLow),
    priorClose: round2(priorClose),
  };
}

const POSTURES: Record<MarketingPreviewStateId, IllustrativePosture> = {
  wait: {
    headline: "Stay patient",
    participation: "Wait for confirmation",
    lean: "Neutral",
    leanTone: "neutral",
    permissionTone: "blocked",
    confidence: "NOT ESTABLISHED",
    confidenceDetail:
      "Confirmation evidence is incomplete. Bullseye remains non-actionable until evidence improves.",
    primaryCondition: "Confirmation evidence is incomplete",
    summary: "Illustrative wait posture. Stay patient while confirmation evidence remains incomplete.",
    supporting: ["Range structure remains orderly", "Cross-asset pressure is muted"],
    opposing: ["No confirmed directional acceptance", "Evidence quality remains incomplete"],
    weather: "Calm / waiting",
    weatherDetail: "Illustrative calm tape — no permission to engage.",
    evidence: ["Lean neutral", "Participation blocked", "Key levels holding"],
    postureHistory: [
      { label: "09:35", lean: "Neutral" },
      { label: "10:05", lean: "Mixed" },
      { label: "10:40", lean: "Neutral" },
    ],
    sessionStatus: "Regular session · illustrative",
  },
  constructive: {
    headline: "Constructive observed lean",
    participation: "Selective — illustrative only",
    lean: "Bullish",
    leanTone: "bull",
    permissionTone: "caution",
    confidence: "62 / 100",
    confidenceDetail: "Illustrative evidence stack only — not a live reading.",
    primaryCondition: "Hold structure above session midpoint",
    summary: "Illustrative constructive session with rising structure and stronger evidence alignment.",
    supporting: ["Higher lows on the illustrative tape", "EMA stack turns constructive", "Internals lean supportive"],
    opposing: ["Event risk remains on the calendar", "Still not live market data"],
    weather: "Constructive",
    weatherDetail: "Illustrative risk-on tone with orderly advances.",
    evidence: ["Bullish lean", "Rising closes", "Supportive internals"],
    postureHistory: [
      { label: "09:35", lean: "Neutral" },
      { label: "10:05", lean: "Bullish" },
      { label: "10:40", lean: "Bullish" },
    ],
    sessionStatus: "Regular session · illustrative",
  },
  defensive: {
    headline: "Defensive observed lean",
    participation: "Stand aside — illustrative only",
    lean: "Bearish",
    leanTone: "bear",
    permissionTone: "blocked",
    confidence: "NOT ESTABLISHED",
    confidenceDetail:
      "Confirmation evidence is incomplete. Bullseye remains non-actionable until evidence improves.",
    primaryCondition: "Protect capital while risk-off pressure persists",
    summary: "Illustrative defensive session with falling structure and weaker participation evidence.",
    supporting: ["Lower highs on the illustrative tape", "Risk-off cross-market pressure"],
    opposing: ["No confirmed reversal acceptance", "Evidence remains incomplete for engagement"],
    weather: "Defensive",
    weatherDetail: "Illustrative risk-off tone with softer internals.",
    evidence: ["Bearish lean", "Falling closes", "Weaker breadth"],
    postureHistory: [
      { label: "09:35", lean: "Mixed" },
      { label: "10:05", lean: "Bearish" },
      { label: "10:40", lean: "Bearish" },
    ],
    sessionStatus: "Regular session · illustrative",
  },
  mixed: {
    headline: "Mixed / no-trade posture",
    participation: "Wait for confirmation",
    lean: "Mixed",
    leanTone: "mixed",
    permissionTone: "blocked",
    confidence: "NOT ESTABLISHED",
    confidenceDetail:
      "Confirmation evidence is incomplete. Bullseye remains non-actionable until evidence improves.",
    primaryCondition: "Conflicting evidence — no trade",
    summary: "Illustrative choppy range with conflicting evidence and an explicit no-trade posture.",
    supporting: ["Range boundaries remain defined"],
    opposing: ["Conflicting internals", "No directional acceptance", "Incomplete confirmation"],
    weather: "Mixed / choppy",
    weatherDetail: "Illustrative two-way trade without clean acceptance.",
    evidence: ["Mixed lean", "Range rotation", "No-trade posture"],
    postureHistory: [
      { label: "09:35", lean: "Bullish" },
      { label: "10:05", lean: "Bearish" },
      { label: "10:40", lean: "Mixed" },
    ],
    sessionStatus: "Regular session · illustrative",
  },
};

function fixtureFor(id: MarketingPreviewStateId): MarketingPreviewFixture {
  const candles = buildCandles(id);
  const levels = levelsFromCandles(candles);
  const last = candles.at(-1)!.close;
  const first = candles[0]!.close;
  const changePct = round2(((last - first) / first) * 100);
  const sparkline = candles
    .filter((_, index) => index % 20 === 0 || index === candles.length - 1)
    .map((candle) => candle.close);
  const invertSparkline = sparkline.map((value) => round2(first * 2 - value));
  const softenSparkline = sparkline.map((value, index) => round2(first + (value - first) * 0.72 + Math.sin(index) * 0.18));
  return {
    id,
    label: id === "wait" ? "Wait" : id === "constructive" ? "Constructive" : id === "defensive" ? "Defensive" : "Mixed",
    illustrative: true,
    disclaimer: DISCLAIMER,
    banner: BANNER,
    posture: POSTURES[id],
    candles,
    levels,
    crossMarket: [
      {
        symbol: "NQ",
        label: "Nasdaq futures",
        change: `${changePct >= 0 ? "+" : ""}${round2(changePct * 1.15)}%`,
        tone: changePct > 0.05 ? "up" : changePct < -0.05 ? "down" : "flat",
        sparkline,
      },
      {
        symbol: "RTY",
        label: "Russell futures",
        change: `${changePct >= 0 ? "+" : ""}${round2(changePct * 0.8)}%`,
        tone: changePct > 0.05 ? "up" : changePct < -0.05 ? "down" : "flat",
        sparkline: softenSparkline,
      },
      {
        symbol: "VIX",
        label: "Volatility proxy",
        change: id === "defensive" ? "+4.2%" : id === "constructive" ? "-3.1%" : "+0.4%",
        tone: id === "defensive" ? "up" : id === "constructive" ? "down" : "flat",
        sparkline: id === "defensive" ? invertSparkline : id === "constructive" ? invertSparkline : softenSparkline,
      },
    ],
  };
}

export const MARKETING_PREVIEW_FIXTURES: Record<MarketingPreviewStateId, MarketingPreviewFixture> = {
  wait: fixtureFor("wait"),
  constructive: fixtureFor("constructive"),
  defensive: fixtureFor("defensive"),
  mixed: fixtureFor("mixed"),
};

export function getMarketingPreviewFixture(id: string | null | undefined): MarketingPreviewFixture {
  if (id && (MARKETING_PREVIEW_STATES as readonly string[]).includes(id)) {
    return MARKETING_PREVIEW_FIXTURES[id as MarketingPreviewStateId];
  }
  return MARKETING_PREVIEW_FIXTURES.wait;
}

export function assertIllustrativeCandleIntegrity(candles: IllustrativeCandle[]): void {
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    if (!(candle.low <= candle.open && candle.open <= candle.high)) {
      throw new Error(`Invalid open relationship at ${index}`);
    }
    if (!(candle.low <= candle.close && candle.close <= candle.high)) {
      throw new Error(`Invalid close relationship at ${index}`);
    }
    if (index > 0 && !(candle.time > candles[index - 1]!.time)) {
      throw new Error(`Timestamps must strictly increase at ${index}`);
    }
  }
}

export function assertLevelOrdering(levels: IllustrativeLevels): void {
  if (!(levels.r2 >= levels.r1 && levels.r1 >= levels.pivot && levels.pivot >= levels.s1 && levels.s1 >= levels.s2)) {
    throw new Error("Level ordering must satisfy R2 ≥ R1 ≥ Pivot ≥ S1 ≥ S2");
  }
  if (!(levels.overnightHigh >= levels.overnightMidpoint && levels.overnightMidpoint >= levels.overnightLow)) {
    throw new Error("Overnight midpoint must sit between overnight high and low");
  }
  if (!(levels.sessionHigh >= levels.sessionLow)) {
    throw new Error("Session high must be at or above session low");
  }
}
