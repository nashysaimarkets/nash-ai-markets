import type { MarketBrief } from "../../lib/market-brief.ts";
import type { MarketEvent, MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { SessionReferenceLevels } from "../../dashboard/lib/session-levels.ts";
import type { DecisionDeskModel } from "../../dashboard/lib/decision-desk.ts";

export type BriefCrossAssetCard = {
  id: "VIX" | "DXY" | "US10Y" | "BREADTH";
  label: string;
  value: string | null;
  change: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  detail: string;
  available: boolean;
};

export type BriefLevelRung = {
  id: string;
  label: string;
  value: string;
  kind: "support" | "resistance" | "reference";
  note: string;
};

export type BriefTimelineItem = {
  id: string;
  time: string;
  name: string;
  risk: "HIGH" | "MED" | "UNKNOWN";
  available: boolean;
};

export type BriefVideoSlot = {
  available: boolean;
  youtubeId: string | null;
  title: string;
  reason: string;
};

export type MorningMarketBriefModel = {
  schemaVersion: "1.0";
  verified: boolean;
  asOfLabel: string;
  dataAgeLabel: string;
  sessionLabel: string;
  sessionDetail: string;
  tierLabel: string;
  greeting: string;
  delayedDisclosure: string;
  summary: {
    headline: string;
    overnight: string;
    whatMatters: string;
    watch: string[];
    avoid: string[];
    highestProbability: string;
  };
  aiBriefing: {
    mode: MarketBrief["mode"];
    sourceLabel: string;
    headline: string;
    body: string;
    focusDrivers: string[];
    confidence: number | null;
  };
  expectedMove: { label: string; detail: string };
  economicTimeline: BriefTimelineItem[];
  overnightNews: {
    available: boolean;
    items: Array<{ id: string; headline: string; detail: string }>;
    reason: string;
  };
  crossAssets: BriefCrossAssetCard[];
  levels: {
    rungs: BriefLevelRung[];
    disclosure: string;
  };
  playbook: {
    posture: string;
    steps: string[];
    confirmations: string[];
  };
  biggestRisk: {
    label: string;
    detail: string;
  };
  video: BriefVideoSlot;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

function quoteOf(quotes: MarketQuote[], symbol: string) {
  return quotes.find((item) => item.symbol === symbol) ?? null;
}

function formatLevel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function highestProbabilityBehaviour(
  intelligence: MarketIntelligence,
  decision: TradingDecision,
  verified: boolean,
): string {
  if (!verified) {
    return "Highest-probability behaviour is withheld until verified decision inputs clear.";
  }
  const ranked = [...intelligence.scenarios].sort((a, b) => b.probability - a.probability);
  const top = ranked[0];
  if (!top) {
    return `Most likely stance remains ${humanize(decision.marketBias)} with a ${humanize(decision.tradePermission)} permission, subject to fresh confirmation.`;
  }
  const label = top.type === "BULLISH"
    ? "constructive upside continuation"
    : top.type === "BEARISH"
      ? "defensive downside pressure"
      : "range / selective participation";
  return `${top.probability}% engine weight favours ${label} while ${humanize(decision.tradePermission)} conditions persist.`;
}

function buildCrossAssets(
  snapshot: MarketSnapshot,
  intelligence: MarketIntelligence,
  verified: boolean,
): BriefCrossAssetCard[] {
  const cards: Array<{ id: BriefCrossAssetCard["id"]; label: string; symbols: string[] }> = [
    { id: "VIX", label: "VIX", symbols: ["VIX"] },
    { id: "DXY", label: "DXY", symbols: ["DXY"] },
    { id: "US10Y", label: "US10Y", symbols: ["US10Y"] },
  ];

  const quoteCards: BriefCrossAssetCard[] = cards.map((card) => {
    const quote = card.symbols.map((symbol) => quoteOf(snapshot.quotes, symbol)).find(Boolean) ?? null;
    if (!quote) {
      return {
        id: card.id,
        label: card.label,
        value: null,
        change: null,
        direction: "unknown" as const,
        detail: `${card.label} awaits a verified provider quote.`,
        available: false,
      };
    }
    return {
      id: card.id,
      label: card.label,
      value: quote.value,
      change: quote.change,
      direction: quote.direction,
      detail: "Verified delayed quote from the market-data feed.",
      available: true,
    };
  });

  const breadthScore = intelligence.scores.marketSentiment;
  const breadthAvailable = verified && Number.isFinite(breadthScore);
  quoteCards.push({
    id: "BREADTH",
    label: "Breadth",
    value: breadthAvailable ? `${Math.round(breadthScore)} / 100` : null,
    change: null,
    direction: "unknown",
    detail: breadthAvailable
      ? "Engine sentiment score only — no verified advance/decline breadth feed is connected."
      : "No verified breadth provider is connected. Breadth stays blank rather than invented.",
    available: breadthAvailable,
  });

  return quoteCards;
}

function buildLevels(
  snapshot: MarketSnapshot,
  sessionLevels: SessionReferenceLevels | null,
  support: string | null,
  resistance: string | null,
): MorningMarketBriefModel["levels"] {
  const rungs: BriefLevelRung[] = [];

  if (resistance) {
    rungs.push({
      id: "key-resistance",
      label: "Upside reference",
      value: resistance,
      kind: "resistance",
      note: "Primary verified upside reference from the market snapshot.",
    });
  }
  const onh = formatLevel(sessionLevels?.overnightHigh);
  if (onh) {
    rungs.push({
      id: "onh",
      label: "Overnight high",
      value: onh,
      kind: "reference",
      note: "Derived from verified OHLCV using America/New_York session windows.",
    });
  }
  for (const level of snapshot.levels.filter((item) => item.type === "resistance").slice(0, 2)) {
    rungs.push({
      id: `r-${level.label}`,
      label: level.label,
      value: level.value,
      kind: "resistance",
      note: level.note || "Verified snapshot resistance.",
    });
  }
  for (const level of snapshot.levels.filter((item) => item.type === "support").slice(0, 2)) {
    rungs.push({
      id: `s-${level.label}`,
      label: level.label,
      value: level.value,
      kind: "support",
      note: level.note || "Verified snapshot support.",
    });
  }
  const onl = formatLevel(sessionLevels?.overnightLow);
  if (onl) {
    rungs.push({
      id: "onl",
      label: "Overnight low",
      value: onl,
      kind: "reference",
      note: "Derived from verified OHLCV using America/New_York session windows.",
    });
  }
  if (support) {
    rungs.push({
      id: "key-support",
      label: "Downside reference",
      value: support,
      kind: "support",
      note: "Primary verified downside reference from the market snapshot.",
    });
  }

  const unique = new Map<string, BriefLevelRung>();
  for (const rung of rungs) {
    const key = `${rung.label}:${rung.value}`;
    if (!unique.has(key)) unique.set(key, rung);
  }

  return {
    rungs: [...unique.values()].slice(0, 8),
    disclosure:
      sessionLevels?.source
      ?? "Levels use verified snapshot prints and candle-derived session references only. Never invented.",
  };
}

function buildTimeline(events: MarketEvent[]): BriefTimelineItem[] {
  if (!events.length) {
    return [{
      id: "empty",
      time: "—",
      name: "No verified economic events listed",
      risk: "UNKNOWN",
      available: false,
    }];
  }
  return events.slice(0, 6).map((event, index) => ({
    id: `${event.time}-${index}`,
    time: event.time,
    name: event.name,
    risk: event.risk,
    available: true,
  }));
}

function resolveVideo(youtubeId: string | null | undefined): BriefVideoSlot {
  const id = youtubeId?.trim() ?? "";
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return {
      available: true,
      youtubeId: id,
      title: "Daily market video",
      reason: "Verified published brief video.",
    };
  }
  return {
    available: false,
    youtubeId: null,
    title: "Daily market video",
    reason:
      "Today’s published market video is not linked yet. The brief remains complete from verified engine inputs — no placeholder clip is shown.",
  };
}

export function composeMorningMarketBrief(input: {
  brief: MarketBrief;
  desk: DecisionDeskModel;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  snapshot: MarketSnapshot;
  sessionLevels: SessionReferenceLevels | null;
  support: string | null;
  resistance: string | null;
  expectedMoveLabel: string;
  asOfLabel: string;
  dataAgeLabel: string;
  sessionLabel: string;
  sessionDetail: string;
  tierLabel: string;
  greeting: string;
  verified: boolean;
  youtubeId?: string | null;
}): MorningMarketBriefModel {
  const { brief, desk, decision, plan, snapshot, verified } = input;
  const watch = verified
    ? [
        ...brief.focusDrivers.slice(0, 3),
        ...brief.nextActions.slice(0, 2),
      ].filter(Boolean).slice(0, 4)
    : ["Wait for verified provider recovery before acting on directional cues."];

  const avoid = verified
    ? [
        brief.avoidWhen,
        ...brief.riskFlags.slice(0, 2),
        ...plan.reasonsToRemainSidelined.slice(0, 2).map(humanize),
      ].filter(Boolean).slice(0, 4)
    : ["Avoid directional participation while the decision window is closed."];

  return {
    schemaVersion: "1.0",
    verified,
    asOfLabel: input.asOfLabel,
    dataAgeLabel: input.dataAgeLabel,
    sessionLabel: input.sessionLabel,
    sessionDetail: input.sessionDetail,
    tierLabel: input.tierLabel,
    greeting: input.greeting,
    delayedDisclosure: "Market Data: Delayed (~10 minutes). Educational commentary only — not personalised advice.",
    summary: {
      headline: brief.headline,
      overnight: brief.whatHappened,
      whatMatters: brief.whatMatters,
      watch: watch.length ? watch : ["No verified watch items published."],
      avoid: avoid.length ? avoid : ["No verified avoidance items published."],
      highestProbability: highestProbabilityBehaviour(input.intelligence, decision, verified),
    },
    aiBriefing: {
      mode: brief.mode,
      sourceLabel: brief.sourceLabel,
      headline: brief.headline,
      body: brief.summary,
      focusDrivers: brief.focusDrivers,
      confidence: brief.confidence,
    },
    expectedMove: {
      label: desk.expectedMove.label,
      detail: desk.expectedMove.detail || input.expectedMoveLabel,
    },
    economicTimeline: buildTimeline(snapshot.events),
    overnightNews: {
      available: false,
      items: [],
      reason:
        "Overnight news headlines are not connected to a verified provider feed on this brief, so none are shown.",
    },
    crossAssets: buildCrossAssets(snapshot, input.intelligence, verified),
    levels: buildLevels(snapshot, input.sessionLevels, input.support, input.resistance),
    playbook: {
      posture: verified
        ? `${desk.marketBias.label} bias · ${humanize(decision.tradePermission)} · ${humanize(decision.recommendedPosture)}`
        : "Stand Aside until verified inputs recover",
      steps: verified
        ? brief.nextActions.slice(0, 5)
        : ["Refresh after a verified provider update", "Confirm delayed-data disclosures before acting"],
      confirmations: verified
        ? plan.requiredConfirmations.slice(0, 5).map(humanize)
        : ["data current", "provider healthy", "decision permission valid"],
    },
    biggestRisk: {
      label: verified
        ? (brief.riskFlags[0] ? brief.riskFlags[0] : humanize(decision.riskRating))
        : "Incomplete verified inputs",
      detail: verified
        ? (brief.avoidWhen || desk.tradeThesis)
        : "Directional guidance stays withheld while provider coverage or freshness is incomplete.",
    },
    video: resolveVideo(input.youtubeId),
  };
}
