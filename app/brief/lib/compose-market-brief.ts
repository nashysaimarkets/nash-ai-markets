import type { MarketBrief } from "../../lib/market-brief.ts";
import type { MarketEvent, MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { SessionReferenceLevels } from "../../dashboard/lib/session-levels.ts";
import type { DecisionDeskModel } from "../../dashboard/lib/decision-desk.ts";
import { interpretCrossMarket } from "../../dashboard/lib/cross-market-interpretation.ts";
import {
  buildDeskDecisionPresentation,
  buildTodaysPosture,
  type TodaysPosture,
} from "../../terminal/lib/desk-decision-presentation.ts";
import {
  groupVerifiedEvents,
  upcomingVerifiedEvents,
} from "../../terminal/lib/event-display.ts";

export type BriefCrossAssetCard = {
  id: "ES" | "VIX" | "DXY" | "US10Y";
  label: string;
  value: string | null;
  change: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  detail: string;
  available: boolean;
  /** Semantic implication for colouring — not the numeric direction alone. */
  implication: "supportive" | "restrictive" | "neutral" | "unknown";
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
  includes: Array<{ name: string; risk: "HIGH" | "MED" }>;
};

export type BriefVideoSlot = {
  available: boolean;
  youtubeId: string | null;
  title: string;
  reason: string;
  type: "PRE_MARKET" | "POST_MARKET" | null;
  marketDate: string | null;
  embedUrl: string | null;
  watchUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  placement: "current" | "earlier" | "hidden";
};

export type BriefServiceItem = {
  label: string;
  detail: string;
  /** Optional enhancements — not core conclusion failures. */
  optional?: boolean;
};

export type MorningMarketBriefModel = {
  schemaVersion: "1.1";
  verified: boolean;
  asOfLabel: string;
  dataAgeLabel: string;
  sessionLabel: string;
  sessionDetail: string;
  tierLabel: string;
  greeting: string;
  /** Session-aware hero clause; navigation label stays Morning Brief. */
  briefHeadline: string;
  delayedDisclosure: string;
  executiveSummary: string;
  posture: TodaysPosture;
  summary: {
    headline: string;
    overnight: string;
    whatMatters: string;
    watch: string[];
    avoid: string[];
    /** Plain-English setup reading — never a raw engine-weight percentage. */
    setupReading: string;
    /** Secondary technical detail for expandable disclosure only. */
    engineWeightDetail: string | null;
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
    leanLabel: string;
    steps: string[];
    confirmations: string[];
  };
  biggestRisk: {
    label: string;
    detail: string;
  };
  video: BriefVideoSlot;
  /** Collapsed earlier briefing when the session has progressed. */
  earlierVideo: BriefVideoSlot | null;
  serviceStatus: BriefServiceItem[];
  serviceStatusSummary: string | null;
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

/** Customer-facing copy only — does not change decision or risk formulas. */
export function customerFacingBriefCopy(value: string): string {
  return value
    .replace(
      /Bullseye is maintaining a no-trade posture[^.]*\.?/gi,
      "Trade participation remains restricted until confirmation clears.",
    )
    .replace(
      /Bullseye has paused directional briefing[^.]*\.?/gi,
      "Directional briefing is paused until verified inputs recover.",
    )
    .replace(/Bullseye will not invent[^.]*\.?/gi, "No values are invented when verification is incomplete.")
    .replace(/critical input missing/gi, "confirmation data is incomplete")
    .replace(/required market evidence is missing/gi, "confirmation data is incomplete")
    .replace(/missing evidence/gi, "confirmation data is incomplete")
    .replace(/low confidence/gi, "confidence not established")
    .replace(/\bno-trade posture\b/gi, "restricted participation")
    .replace(/\bstand aside\b/gi, "restricted")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhrase(value: string): string {
  return customerFacingBriefCopy(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalKey(value: string): string {
  const normalized = normalizePhrase(value);
  if (/confirmation data is incomplete|incomplete verified|missing evidence|critical input/.test(normalized)) {
    return "confirmation-incomplete";
  }
  if (/confidence not established|low confidence|confidence is too low/.test(normalized)) {
    return "confidence";
  }
  if (/no[- ]trade|stand aside|participation/.test(normalized) && /avoid|remain|closed|restricted/.test(normalized)) {
    return "participation-restricted";
  }
  if (/volatil/.test(normalized)) return "volatility";
  if (/range|level|structure/.test(normalized)) return "range";
  if (/event|catalyst|calendar/.test(normalized)) return "event";
  return normalized.slice(0, 48);
}

/** Unique practical customer bullets — never empty duplicates of the same warning. */
export function dedupePracticalItems(items: string[], max = 3): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const item = raw?.trim();
    if (!item) continue;
    const key = canonicalKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= max) break;
  }
  return result;
}

function cardImplication(
  id: BriefCrossAssetCard["id"],
  direction: MarketQuote["direction"],
): BriefCrossAssetCard["implication"] {
  if (direction === "flat") return "neutral";
  if (id === "VIX") return direction === "down" ? "supportive" : "restrictive";
  if (id === "DXY") return direction === "down" ? "supportive" : "restrictive";
  if (id === "ES") return direction === "up" ? "supportive" : "restrictive";
  if (id === "US10Y") return "neutral";
  return "unknown";
}

function cardInterpretation(
  id: BriefCrossAssetCard["id"],
  direction: MarketQuote["direction"],
): string {
  if (id === "ES") {
    if (direction === "up") return "ES is higher on the latest verified print.";
    if (direction === "down") return "ES is lower on the latest verified print.";
    return "ES is broadly unchanged on the latest verified print.";
  }
  if (id === "VIX") {
    if (direction === "down") return "Volatility is easing — often supportive of risk appetite.";
    if (direction === "up") return "Volatility is rising — often a constraint on risk appetite.";
    return "Volatility is broadly unchanged.";
  }
  if (id === "DXY") {
    if (direction === "down") return "The dollar is softer on the latest verified print.";
    if (direction === "up") return "The dollar is firmer on the latest verified print.";
    return "The dollar is broadly unchanged.";
  }
  if (direction === "up") return "The 10-year yield is higher.";
  if (direction === "down") return "The 10-year yield is lower.";
  return "The 10-year yield is broadly unchanged.";
}

function setupReading(
  intelligence: MarketIntelligence,
  decision: TradingDecision,
  verified: boolean,
): { reading: string; engineWeightDetail: string | null } {
  if (!verified) {
    return {
      reading: "Verified decision inputs are incomplete, so no directional setup is established.",
      engineWeightDetail: null,
    };
  }

  const ranked = [...intelligence.scenarios].sort((a, b) => b.probability - a.probability);
  const top = ranked[0] ?? null;
  const engineWeightDetail = top
    ? `Engine scenario weight: ${top.probability}% toward ${humanize(top.type)} (technical detail only).`
    : null;

  if (decision.tradePermission === "no-trade") {
    if (decision.marketBias === "neutral" || decision.conflictingDrivers.length > 0 || (top && top.probability < 55)) {
      return {
        reading: "Current evidence is mixed and does not establish a validated directional setup.",
        engineWeightDetail,
      };
    }
    if (decision.marketBias === "bullish") {
      return {
        reading: "A constructive lean is visible in verified inputs, but confirmation remains incomplete and participation stays restricted.",
        engineWeightDetail,
      };
    }
    if (decision.marketBias === "bearish") {
      return {
        reading: "A defensive lean is visible in verified inputs, but confirmation remains incomplete and participation stays restricted.",
        engineWeightDetail,
      };
    }
  }

  if (decision.tradePermission === "caution") {
    return {
      reading: `Observed lean is ${humanize(decision.marketBias)}, with caution required before treating it as a validated setup.`,
      engineWeightDetail,
    };
  }

  return {
    reading: `Observed lean is ${humanize(decision.marketBias)}. Participation checks allow selective engagement subject to your own rules.`,
    engineWeightDetail,
  };
}

function buildCrossAssets(snapshot: MarketSnapshot): BriefCrossAssetCard[] {
  const cards: Array<{ id: BriefCrossAssetCard["id"]; label: string; symbols: string[] }> = [
    { id: "ES", label: "ES", symbols: ["ES"] },
    { id: "VIX", label: "VIX", symbols: ["VIX"] },
    { id: "DXY", label: "DXY", symbols: ["DXY"] },
    { id: "US10Y", label: "US 10-year", symbols: ["US10Y"] },
  ];

  return cards.map((card) => {
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
        implication: "unknown" as const,
      };
    }
    return {
      id: card.id,
      label: card.label,
      value: quote.value,
      change: quote.change,
      direction: quote.direction,
      detail: cardInterpretation(card.id, quote.direction),
      available: true,
      implication: cardImplication(card.id, quote.direction),
    };
  });
}

function buildLevels(
  snapshot: MarketSnapshot,
  sessionLevels: SessionReferenceLevels | null,
  support: string | null,
  resistance: string | null,
): MorningMarketBriefModel["levels"] {
  const rungs: BriefLevelRung[] = [];

  if (support) {
    rungs.push({
      id: "key-support",
      label: "24-hour low / downside reference",
      value: support,
      kind: "support",
      note: "Verified downside reference",
    });
  }
  const onl = formatLevel(sessionLevels?.overnightLow);
  if (onl && onl !== support) {
    rungs.push({
      id: "onl",
      label: "Overnight low reference",
      value: onl,
      kind: "reference",
      note: "Session window reference",
    });
  }
  const open = formatLevel(sessionLevels?.todaysOpen);
  if (open) {
    rungs.push({
      id: "open",
      label: "Session opening reference",
      value: open,
      kind: "reference",
      note: "Session window reference",
    });
  }
  const onh = formatLevel(sessionLevels?.overnightHigh);
  if (onh && onh !== resistance) {
    rungs.push({
      id: "onh",
      label: "Overnight high reference",
      value: onh,
      kind: "reference",
      note: "Session window reference",
    });
  }
  if (resistance) {
    rungs.push({
      id: "key-resistance",
      label: "24-hour high / upside reference",
      value: resistance,
      kind: "resistance",
      note: "Verified upside reference",
    });
  }

  const unique = new Map<string, BriefLevelRung>();
  for (const rung of rungs) {
    const key = `${rung.label}:${rung.value}`;
    if (!unique.has(key)) unique.set(key, rung);
  }

  return {
    rungs: [...unique.values()].slice(0, 6),
    disclosure:
      "Educational references from verified prints — not confirmed support or resistance.",
  };
}

function buildTimeline(events: MarketEvent[], now = Date.now()): BriefTimelineItem[] {
  return groupVerifiedEvents(events, now, 3).map((event, index) => ({
    id: `${event.at ?? event.time}-${index}`,
    time: event.time,
    name: event.name,
    risk: event.risk,
    available: true,
    includes: event.includes,
  }));
}

function resolveVideo(input: {
  youtubeId?: string | null;
}): BriefVideoSlot {
  const id = input.youtubeId?.trim() ?? "";
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return {
      available: true,
      youtubeId: id,
      title: "Daily market video",
      reason: "Verified published brief video.",
      type: null,
      marketDate: null,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      durationSeconds: null,
      placement: "current",
    };
  }
  return unavailableVideoSlot(null);
}

function unavailableVideoSlot(type: "PRE_MARKET" | "POST_MARKET" | null): BriefVideoSlot {
  return {
    available: false,
    youtubeId: null,
    title: type === "POST_MARKET" ? "Post-market video review" : "Pre-market video briefing",
    reason:
      "Today’s video review has not been published yet. The verified written briefing remains available below.",
    type,
    marketDate: null,
    embedUrl: null,
    watchUrl: null,
    thumbnailUrl: null,
    durationSeconds: null,
    placement: "hidden",
  };
}

function buildWatchAvoid(input: {
  verified: boolean;
  brief: MarketBrief;
  plan: TradePlan;
  snapshot: MarketSnapshot;
  sessionLevels: SessionReferenceLevels | null;
  support: string | null;
  resistance: string | null;
  now: number;
  leanLabel?: string;
  permissionTone?: string;
}): { watch: string[]; avoid: string[] } {
  if (!input.verified) {
    return {
      watch: ["Verified provider recovery before using directional cues"],
      avoid: ["Treating an incomplete decision window as a trade setup"],
    };
  }

  const vix = quoteOf(input.snapshot.quotes, "VIX");
  const dxy = quoteOf(input.snapshot.quotes, "DXY");
  const us10 = quoteOf(input.snapshot.quotes, "US10Y");
  const hasUpcoming = upcomingVerifiedEvents(input.snapshot.events, input.now, 1).length > 0;
  const open = formatLevel(input.sessionLevels?.todaysOpen);
  const lean = (input.leanLabel ?? "").toLowerCase();
  const restricted = /blocked|restricted|caution|stand.?aside|no.?trade/i.test(
    `${input.permissionTone ?? ""} ${input.leanLabel ?? ""}`,
  );

  const watchCandidates = [
    input.resistance ? "Response near the verified 24-hour high" : null,
    input.support ? "Defence near the verified 24-hour low" : null,
    vix?.direction === "down"
      ? "Whether lower volatility persists"
      : vix?.direction === "up"
        ? "Whether volatility pressure keeps rising"
        : null,
    dxy || us10 ? "Confirmation from the dollar and yields" : null,
    open ? "Behaviour around the session-opening reference" : null,
    hasUpcoming ? "Price behaviour around the next scheduled release" : null,
    /buy|bull/i.test(lean) ? "Whether the observed upward lean continues to hold" : null,
    /sell|bear/i.test(lean) ? "Whether the observed downward lean continues to hold" : null,
    restricted ? "Whether participation conditions improve later in the session" : null,
  ].filter((item): item is string => Boolean(item));

  const avoidCandidates = [
    "Treating an observed lean as a completed setup",
    input.resistance || input.support
      ? "Chasing price at the edge of the verified range"
      : "Assuming recent prints predict the next move",
    hasUpcoming ? "Increasing exposure immediately before unresolved event risk" : null,
    "Assuming the recent range predicts the next move",
    restricted ? "Forcing participation while confirmation remains incomplete" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    watch: dedupePracticalItems(watchCandidates, 4),
    avoid: dedupePracticalItems(avoidCandidates, 4),
  };
}

function stripRepeatedPosturePhrases(value: string): string {
  return value
    .replace(/\s*confirmation remains incomplete[^.]*\.?/gi, "")
    .replace(/\s*participation (?:is|remains) restricted[^.]*\.?/gi, "")
    .replace(/\s*not a validated (?:trade )?setup[^.]*\.?/gi, "")
    .replace(/\s*observed market lean is [^.]*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExecutiveSummary(input: {
  snapshot: MarketSnapshot;
  decision: TradingDecision;
  verified: boolean;
  interpretation: string;
}): string {
  if (!input.verified) {
    return `${input.interpretation} Verified observations may still appear below.`;
  }
  return `${input.interpretation} These remain observations from delayed verified quotes.`;
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
  briefHeadline?: string;
  verified: boolean;
  youtubeId?: string | null;
  /** Current primary video for this session phase. */
  videoSlot?: BriefVideoSlot | null;
  /** Dated earlier briefing kept collapsed after the open. */
  earlierVideoSlot?: BriefVideoSlot | null;
  sessionPhase?: string;
  now?: number;
}): MorningMarketBriefModel {
  const { brief, desk, decision, plan, snapshot, verified } = input;
  const now = input.now ?? Date.now();
  const interpretation = interpretCrossMarket(snapshot);
  const { reading, engineWeightDetail } = setupReading(input.intelligence, decision, verified);
  const presentation = buildDeskDecisionPresentation({
    decision,
    plan,
    signals: null,
    warnings: [
      ...decision.noTradeReasons,
      ...decision.dataQualityWarnings.map((item) => item.code),
    ],
  });
  const posture = buildTodaysPosture(presentation);
  const { watch, avoid } = buildWatchAvoid({
    verified,
    brief,
    plan,
    snapshot,
    sessionLevels: input.sessionLevels,
    support: input.support,
    resistance: input.resistance,
    now,
    leanLabel: presentation.leanLabel,
    permissionTone: presentation.permissionTone,
  });
  const crossAssets = buildCrossAssets(snapshot);
  const timeline = buildTimeline(snapshot.events, now);
  const video = input.videoSlot ?? resolveVideo({
    youtubeId: input.youtubeId,
  });
  const earlierVideo = input.earlierVideoSlot?.available
    ? { ...input.earlierVideoSlot, placement: "earlier" as const }
    : null;

  const serviceStatus: BriefServiceItem[] = [];
  for (const card of crossAssets.filter((item) => !item.available)) {
    serviceStatus.push({
      label: `${card.label} context`,
      detail: card.detail,
      optional: card.id !== "ES",
    });
  }
  if (!timeline.length) {
    serviceStatus.push({
      label: "Upcoming catalysts",
      detail: "No upcoming verified event is currently available.",
      optional: true,
    });
  }

  const coreIssues = serviceStatus.filter((item) => !item.optional);
  const optionalIssues = serviceStatus.filter((item) => item.optional);
  const materialOptional = optionalIssues.filter((item) =>
    /VIX|DXY|yield|10-?year|catalyst/i.test(`${item.label} ${item.detail}`),
  );

  let serviceStatusSummary: string | null = null;
  if (coreIssues.length) {
    serviceStatusSummary =
      coreIssues.length === 1
        ? `${coreIssues[0]!.detail}`
        : `Core price context is incomplete (${coreIssues.length} inputs unavailable), so the decision summary stays limited.`;
  } else if (materialOptional.length === 1 && /VIX|volatility/i.test(materialOptional[0]!.label)) {
    serviceStatusSummary =
      "Volatility context is currently unavailable, so VIX is excluded from this briefing.";
  } else if (materialOptional.length === 1 && /DXY|dollar/i.test(materialOptional[0]!.label)) {
    serviceStatusSummary =
      "Dollar context is currently unavailable, so DXY is excluded from this briefing.";
  } else if (materialOptional.length === 1 && /yield|10/i.test(materialOptional[0]!.label)) {
    serviceStatusSummary =
      "Yield context is currently unavailable, so the 10-year reading is excluded from this briefing.";
  } else if (materialOptional.length > 1) {
    serviceStatusSummary =
      "Some optional market context is unavailable. Core price data remain available.";
  } else if (optionalIssues.some((item) => /catalyst/i.test(item.label)) && optionalIssues.length === 1) {
    serviceStatusSummary = null;
  } else {
    serviceStatusSummary = null;
  }

  return {
    schemaVersion: "1.1",
    verified,
    asOfLabel: input.asOfLabel,
    dataAgeLabel: input.dataAgeLabel,
    sessionLabel: input.sessionLabel,
    sessionDetail: input.sessionDetail,
    tierLabel: input.tierLabel,
    greeting: input.greeting,
    briefHeadline: input.briefHeadline ?? "Here is today’s market briefing.",
    delayedDisclosure: input.dataAgeLabel,
    executiveSummary: buildExecutiveSummary({
      snapshot,
      decision,
      verified,
      interpretation,
    }),
    posture,
    summary: {
      headline: customerFacingBriefCopy(brief.headline),
      overnight: verified
        ? "Cross-market prints moved as shown in Market Weather. Use those cards for the factual change set."
        : "Session context stays limited until verified provider prints recover.",
      whatMatters: stripRepeatedPosturePhrases(customerFacingBriefCopy(brief.whatMatters))
        || "Review Market Weather and verified levels before treating any lean as actionable.",
      watch,
      avoid,
      setupReading: reading,
      engineWeightDetail,
    },
    aiBriefing: {
      mode: brief.mode,
      sourceLabel: brief.sourceLabel,
      headline: customerFacingBriefCopy(brief.headline),
      body: customerFacingBriefCopy(brief.summary),
      focusDrivers: brief.focusDrivers,
      confidence: brief.confidence,
    },
    expectedMove: {
      label: desk.expectedMove.label,
      detail: desk.expectedMove.detail || input.expectedMoveLabel,
    },
    economicTimeline: timeline,
    overnightNews: {
      available: false,
      items: [],
      reason:
        "Overnight news headlines are not connected to a verified provider feed on this brief, so none are shown.",
    },
    crossAssets: crossAssets.filter((card) => card.available),
    levels: buildLevels(snapshot, input.sessionLevels, input.support, input.resistance),
    playbook: {
      posture: customerFacingBriefCopy(
        verified
          ? `${desk.marketBias.label} bias · ${humanize(decision.tradePermission)} · ${humanize(decision.recommendedPosture)}`
          : "Wait for confirmation until verified inputs recover",
      ),
      leanLabel: presentation.leanLabel,
      steps: verified
        ? brief.nextActions.slice(0, 5).map(customerFacingBriefCopy)
        : ["Refresh after a verified provider update", "Confirm delayed-data disclosures before acting"],
      confirmations: verified
        ? plan.requiredConfirmations.slice(0, 5).map(humanize)
        : ["data current", "provider healthy", "participation checks passed"],
    },
    biggestRisk: {
      label: verified
        ? customerFacingBriefCopy(brief.riskFlags[0] ? brief.riskFlags[0] : humanize(decision.riskRating))
        : "Confirmation data is incomplete",
      detail: customerFacingBriefCopy(
        verified
          ? (brief.avoidWhen || desk.tradeThesis)
          : "Directional guidance stays withheld while provider coverage or freshness is incomplete.",
      ),
    },
    video,
    earlierVideo,
    serviceStatus,
    serviceStatusSummary,
  };
}
