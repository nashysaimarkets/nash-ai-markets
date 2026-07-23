import type { MarketSnapshot, MarketQuote } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { MarketGatewayStatus } from "./live-market-gateway.ts";
import type { MarketDeskSignals } from "./market-desk-signals.ts";
import type { MarketStructureLevels, InstrumentStructureLevels } from "./market-structure-levels.ts";
import {
  MARKET_BOARD_LABELS,
  MARKET_BOARD_SYMBOLS,
  isTreasuryScalar,
  type MarketBoardSymbol,
} from "./market-board-instruments.ts";
import { candleSupportNote, isCandleInstrument } from "./providers/candle-instruments.ts";
import { formatAgeFromMs } from "./freshness-labels.ts";

export type AskBullseyeContext = {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  gateway: MarketGatewayStatus;
  decisionReady: boolean;
  bullishConfirm: string;
  bearishConfirm: string;
  invalidation: string;
  noTrade: string[];
  dataAge: string;
  deskSignals?: MarketDeskSignals | null;
  structure?: MarketStructureLevels | null;
};

export type AskBullseyeQuestion = {
  id: string;
  label: string;
};

export const ASK_BULLSEYE_QUESTIONS: AskBullseyeQuestion[] = [
  { id: "matters-most", label: "What matters most right now?" },
  { id: "desk-lean", label: "Is the desk leaning buy or sell?" },
  { id: "stand-aside", label: "Why is Bullseye standing aside?" },
  { id: "bullish", label: "What would make the outlook bullish?" },
  { id: "bearish", label: "What would make the outlook bearish?" },
  { id: "missing", label: "What evidence is missing?" },
  { id: "range", label: "What are the verified range levels?" },
  { id: "age", label: "How old is the data?" },
  { id: "watch-next", label: "What should I watch next?" },
  { id: "cross-asset", label: "What are the cross-asset readings?" },
];

export type AskBullseyeAnswer = {
  questionId: string;
  title: string;
  body: string;
  bullets: string[];
  disclaimer: string;
};

export type ParsedAskQuery = {
  questionId: string;
  symbol: MarketBoardSymbol | null;
  raw: string;
};

const DISCLAIMER =
  "Deterministic educational market intelligence from verified application evidence only. Not personalised financial advice.";

const INSTRUMENT_ALIASES: Array<{ symbol: MarketBoardSymbol; patterns: RegExp[] }> = [
  { symbol: "ES", patterns: [/\bes\b/, /\besusd\b/, /\bs&p\b/, /\bspx\b/, /\bfutures?\b/, /\be[- ]?mini\b/] },
  { symbol: "VIX", patterns: [/\bvix\b/, /\bvolatility\b/, /\bfear index\b/] },
  { symbol: "DXY", patterns: [/\bdxy\b/, /\bdollar index\b/, /\bus dollar\b/, /\busdx\b/] },
  { symbol: "OIL", patterns: [/\boil\b/, /\buso\b/, /\bcrude\b/, /\bwti\b/] },
  { symbol: "QQQ", patterns: [/\bqqq\b/, /\bnasdaq[- ]?100 etf\b/] },
  { symbol: "NQ", patterns: [/\bnq\b/, /\bnasdaq\b/, /\bixic\b/, /\btech composite\b/] },
  { symbol: "US2Y", patterns: [/\bus2y\b/, /\b2[- ]?year\b/, /\b2y\b/] },
  { symbol: "US10Y", patterns: [/\bus10y\b/, /\b10[- ]?year\b/, /\b10y\b/, /\btreasur(?:y|ies)\b/] },
];

function esQuote(snapshot: MarketSnapshot) {
  return snapshot.quotes.find((q) => q.symbol === "ES");
}

function quoteFor(snapshot: MarketSnapshot, symbol: MarketBoardSymbol): MarketQuote | undefined {
  return snapshot.quotes.find((q) => q.symbol === symbol);
}

function supportResistance(snapshot: MarketSnapshot) {
  const support = snapshot.levels.find((level) => level.type === "support");
  const resistance = snapshot.levels.find((level) => level.type === "resistance");
  return { support, resistance };
}

function structureFor(
  ctx: AskBullseyeContext,
  symbol: MarketBoardSymbol,
): InstrumentStructureLevels | null {
  return ctx.structure?.instruments.find((item) => item.symbol === symbol) ?? null;
}

function driverLabel(item: { factor: string } | string): string {
  return typeof item === "string" ? item : item.factor;
}

function warningLabel(item: { code: string; field?: string } | string): string {
  if (typeof item === "string") return item;
  return item.field ? `${item.code} (${item.field})` : item.code;
}

function detectInstrument(text: string): MarketBoardSymbol | null {
  for (const entry of INSTRUMENT_ALIASES) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.symbol;
  }
  for (const symbol of MARKET_BOARD_SYMBOLS) {
    if (text.includes(symbol.toLowerCase())) return symbol;
  }
  return null;
}

/**
 * Map free-form subscriber questions onto deterministic answer ids.
 * Never invents instruments or prices — unknown asks fall back to a guided help answer.
 */
export function parseAskBullseyeQuery(raw: string): ParsedAskQuery {
  const text = raw.trim().toLowerCase();
  const symbol = detectInstrument(text);

  if (!text) {
    return { questionId: "matters-most", symbol: null, raw };
  }

  if (/\b(stand[- ]?aside|no[- ]?trade|why (closed|waiting)|permission)\b/.test(text)) {
    return { questionId: "stand-aside", symbol, raw };
  }
  if (/\b(desk|lean|buy(?:ing)?|sell(?:ing)?)\b/.test(text) && !/\bbullish\b|\bbearish\b/.test(text)) {
    return { questionId: "desk-lean", symbol, raw };
  }
  if (/\b(support|resistance|s\/r|range level|desk level)\b/.test(text)) {
    return { questionId: symbol ? "instrument-structure" : "range", symbol, raw };
  }
  if (/\b(price|last|quote|trading at|level is|what(?:'s| is) .+ (at|doing))\b/.test(text) || (symbol && /\b(what(?:'s| is)|where is|show)\b/.test(text) && !/\bage|old|fresh|support|resistance\b/.test(text))) {
    return { questionId: symbol ? "instrument-price" : "matters-most", symbol, raw };
  }
  if (/\b(change|direction|up|down|move|moved|higher|lower)\b/.test(text) && symbol) {
    return { questionId: "instrument-change", symbol, raw };
  }
  if (/\b(age|old|fresh|stale|delay|as of|how recent)\b/.test(text)) {
    return { questionId: "age", symbol, raw };
  }
  if (/\b(cross[- ]?asset|all markets|board|every instrument|oil|vix|dxy|qqq|nasdaq|treasur)\b/.test(text) && !symbol) {
    return { questionId: "cross-asset", symbol: null, raw };
  }
  if (/\b(missing|incomplete|gap|unavailable evidence)\b/.test(text)) {
    return { questionId: "missing", symbol, raw };
  }
  if (/\bbullish\b/.test(text)) return { questionId: "bullish", symbol, raw };
  if (/\bbearish\b/.test(text)) return { questionId: "bearish", symbol, raw };
  if (/\b(watch|next|catalyst)\b/.test(text)) return { questionId: "watch-next", symbol, raw };
  if (/\b(matter|overview|summary|right now)\b/.test(text)) return { questionId: "matters-most", symbol, raw };

  if (symbol) {
    return { questionId: "instrument-price", symbol, raw };
  }

  return { questionId: "help", symbol: null, raw };
}

function answerInstrumentPrice(symbol: MarketBoardSymbol, ctx: AskBullseyeContext): AskBullseyeAnswer {
  const label = MARKET_BOARD_LABELS[symbol];
  const quote = quoteFor(ctx.snapshot, symbol);
  const note = candleSupportNote(symbol);
  if (!quote) {
    return {
      questionId: "instrument-price",
      title: `${label} last reading`,
      body: `Insufficient verified data for ${label}. No last price is shown until the provider returns a verified quote.`,
      bullets: [
        `Instrument: ${symbol}`,
        `Snapshot age: ${ctx.dataAge}`,
        note ?? "Candlestick history may still be unavailable even when a quote returns.",
      ],
      disclaimer: DISCLAIMER,
    };
  }
  return {
    questionId: "instrument-price",
    title: `${label} last reading`,
    body: `${label} verified last ${quote.value} (${quote.change}, ${quote.direction}). This is the provider quote already on the board — not a projected move.`,
    bullets: [
      `Symbol: ${quote.symbol}`,
      `Direction: ${quote.direction}`,
      `Snapshot age: ${ctx.dataAge}`,
      isTreasuryScalar(symbol)
        ? "Treasury yields remain scalar-only; OHLC candles are unavailable for this feed."
        : note ?? "Ask about support/resistance for verified candle-range desk levels when available.",
    ],
    disclaimer: DISCLAIMER,
  };
}

function answerInstrumentChange(symbol: MarketBoardSymbol, ctx: AskBullseyeContext): AskBullseyeAnswer {
  const label = MARKET_BOARD_LABELS[symbol];
  const quote = quoteFor(ctx.snapshot, symbol);
  if (!quote) {
    return {
      questionId: "instrument-change",
      title: `${label} direction`,
      body: `Insufficient verified data for ${label} direction. No change is inferred from missing quotes.`,
      bullets: [`Snapshot age: ${ctx.dataAge}`],
      disclaimer: DISCLAIMER,
    };
  }
  return {
    questionId: "instrument-change",
    title: `${label} direction`,
    body: `${label} latest verified move is ${quote.change} (${quote.direction}) from last ${quote.value}.`,
    bullets: [
      `Market status: ${ctx.snapshot.status}`,
      `Snapshot age: ${ctx.dataAge}`,
      "Direction is descriptive of the verified quote change only — not a trade signal.",
    ],
    disclaimer: DISCLAIMER,
  };
}

function answerInstrumentStructure(symbol: MarketBoardSymbol, ctx: AskBullseyeContext): AskBullseyeAnswer {
  const label = MARKET_BOARD_LABELS[symbol];
  const levels = structureFor(ctx, symbol);
  if (isTreasuryScalar(symbol) || candleSupportNote(symbol)) {
    return {
      questionId: "instrument-structure",
      title: `${label} support & resistance`,
      body: candleSupportNote(symbol)
        ?? `${label} is a verified scalar feed. OHLC support/resistance is unavailable.`,
      bullets: [
        quoteFor(ctx.snapshot, symbol)
          ? `Verified scalar reading: ${quoteFor(ctx.snapshot, symbol)!.value}`
          : "Scalar quote also unavailable in this snapshot",
        `Snapshot age: ${ctx.dataAge}`,
      ],
      disclaimer: DISCLAIMER,
    };
  }
  if (!levels || levels.status !== "ready" || !levels.support || !levels.resistance) {
    return {
      questionId: "instrument-structure",
      title: `${label} support & resistance`,
      body: levels?.summary
        ?? `Insufficient verified candle range for ${label}. Desk support/resistance stays withheld.`,
      bullets: [
        `Snapshot age: ${ctx.dataAge}`,
        isCandleInstrument(symbol)
          ? "Candlestick-derived levels appear only when verified OHLCV exists."
          : "This instrument is not configured for candlestick-derived desk levels.",
      ],
      disclaimer: DISCLAIMER,
    };
  }
  return {
    questionId: "instrument-structure",
    title: `${label} support & resistance`,
    body: levels.summary,
    bullets: [
      `Support: ${levels.support.display} · ${levels.support.source}`,
      `Resistance: ${levels.resistance.display} · ${levels.resistance.source}`,
      ...levels.references.slice(0, 3).map((ref) => `${ref.label}: ${ref.display}`),
      ctx.structure?.disclosure ?? DISCLAIMER,
    ],
    disclaimer: DISCLAIMER,
  };
}

function answerCrossAsset(ctx: AskBullseyeContext): AskBullseyeAnswer {
  const bullets = MARKET_BOARD_SYMBOLS.map((symbol) => {
    const quote = quoteFor(ctx.snapshot, symbol);
    const label = MARKET_BOARD_LABELS[symbol];
    if (!quote) return `${label}: insufficient verified quote`;
    return `${label}: ${quote.value} (${quote.change}, ${quote.direction})`;
  });
  return {
    questionId: "cross-asset",
    title: "Cross-asset verified readings",
    body: "These are the verified board quotes currently available in the product. Missing instruments stay listed as insufficient — values are never invented.",
    bullets: [
      ...bullets,
      `Snapshot age: ${ctx.dataAge}`,
      `Market status: ${ctx.snapshot.status}`,
    ],
    disclaimer: DISCLAIMER,
  };
}

function answerHelp(raw: string): AskBullseyeAnswer {
  const markets = MARKET_BOARD_SYMBOLS.map((symbol) => MARKET_BOARD_LABELS[symbol]).join(", ");
  return {
    questionId: "help",
    title: "How to ask Bullseye",
    body: raw.trim()
      ? "That question could not be mapped onto verified product evidence. Try a market price, change, support/resistance, freshness, desk lean, stand-aside, or cross-asset question."
      : "Ask about verified markets already on the site. Answers stay deterministic and fail closed when evidence is missing.",
    bullets: [
      `Markets covered: ${markets}`,
      "Examples: “What is ES last?”, “Oil support and resistance”, “How old is the data?”, “Why stand aside?”",
      "Bullseye will not invent prices, forecasts, or candle levels.",
    ],
    disclaimer: DISCLAIMER,
  };
}

export function answerAskBullseye(
  questionId: string,
  ctx: AskBullseyeContext,
  symbol: MarketBoardSymbol | null = null,
): AskBullseyeAnswer {
  if (questionId === "instrument-price" && symbol) return answerInstrumentPrice(symbol, ctx);
  if (questionId === "instrument-change" && symbol) return answerInstrumentChange(symbol, ctx);
  if (questionId === "instrument-structure" && symbol) return answerInstrumentStructure(symbol, ctx);
  if (questionId === "cross-asset") return answerCrossAsset(ctx);
  if (questionId === "help") return answerHelp("");

  const es = esQuote(ctx.snapshot);
  const { support, resistance } = supportResistance(ctx.snapshot);
  const posture = ctx.decisionReady
    ? ctx.plan.directionalPosture.replaceAll("_", " ")
    : "Stand aside";
  const permission = ctx.decisionReady
    ? ctx.decision.tradePermission.replaceAll("-", " ")
    : "No trade permitted";
  const supporting = ctx.decision.topSupportingDrivers.slice(0, 4).map(driverLabel);
  const conflicting = ctx.decision.conflictingDrivers.slice(0, 4).map(driverLabel);
  const missing = ctx.intelligence.reasoning.missingDataWarnings.slice(0, 5).map(warningLabel);
  const noTrade = ctx.noTrade.length ? ctx.noTrade : ctx.decision.noTradeReasons;

  // Instrument-tagged generic questions still answer the core topic, then add quote context.
  const instrumentNote = symbol
    ? (() => {
      const quote = quoteFor(ctx.snapshot, symbol);
      const label = MARKET_BOARD_LABELS[symbol];
      return quote
        ? `${label} verified last ${quote.value} (${quote.change}).`
        : `${label} has no verified quote in this snapshot.`;
    })()
    : null;

  switch (questionId) {
    case "matters-most":
      return {
        questionId,
        title: "What matters most right now",
        body: ctx.decisionReady
          ? `ES reference ${es?.value ?? "unavailable"}. Posture is ${posture}. Permission is ${permission}. Risk ${ctx.decision.riskRating}; volatility ${ctx.decision.volatilityRegime}.`
          : "Verified decision inputs are incomplete or aged. Stand aside until fresh evidence restores decision readiness.",
        bullets: [
          ...(supporting.length ? supporting.map((item) => `Supporting: ${item}`) : ["Supporting evidence: incomplete"]),
          ...(conflicting.length ? conflicting.map((item) => `Conflict: ${item}`) : ["No principal conflicting drivers listed"]),
          `Snapshot age: ${ctx.dataAge}`,
          ...(instrumentNote ? [instrumentNote] : []),
        ],
        disclaimer: DISCLAIMER,
      };
    case "desk-lean": {
      const desk = ctx.deskSignals;
      if (!desk || desk.overallLean === "insufficient") {
        return {
          questionId,
          title: "Desk buying and selling lean",
          body: "Interpretive desk signals are unavailable until verified snapshot inputs are complete. No buying or selling lean is inferred from empty evidence.",
          bullets: [
            "Educational desk leans require verified ES and cross-asset quotes.",
            `Snapshot age: ${ctx.dataAge}`,
            desk?.disclosure ?? "Desk signals stay educational and never become executable orders.",
          ],
          disclaimer: DISCLAIMER,
        };
      }
      const active = desk.overallLean === "buying" ? desk.buying : desk.overallLean === "selling" ? desk.selling : null;
      return {
        questionId,
        title: "Desk buying and selling lean",
        body: active
          ? `${active.headline}. ${active.summary}`
          : `Overall desk lean is ${desk.overallLean}. Buying is ${desk.buying.status}; selling is ${desk.selling.status}.`,
        bullets: [
          ...(active?.drivers.slice(0, 3) ?? [
            `Buying: ${desk.buying.headline}`,
            `Selling: ${desk.selling.headline}`,
          ]),
          active ? `Watching: ${active.watchingFor}` : `Buying watch: ${desk.buying.watchingFor}`,
          desk.disclosure,
          ...(instrumentNote ? [instrumentNote] : []),
        ],
        disclaimer: DISCLAIMER,
      };
    }
    case "stand-aside":
      return {
        questionId,
        title: "Why Bullseye is standing aside",
        body: permission === "No trade permitted" || !ctx.decisionReady
          ? "Trade permission remains closed. Directional participation waits for cleaner confirmation and fresher verified data."
          : `Permission is currently ${permission}. Participation still depends on confirmations and invalidation discipline.`,
        bullets: (noTrade.length ? noTrade : ["No explicit no-trade codes beyond closed permission"]).slice(0, 5),
        disclaimer: DISCLAIMER,
      };
    case "bullish":
      return {
        questionId,
        title: "What would make the outlook bullish",
        body: `Bullish confirmation above: ${ctx.bullishConfirm}`,
        bullets: [
          `Invalidation if: ${ctx.invalidation}`,
          supporting[0] ? `Would be helped by: ${supporting[0]}` : "Need clearer supporting evidence",
          ctx.decisionReady ? `Current bias: ${ctx.decision.marketBias}` : "Bias withheld until decision-ready data",
        ],
        disclaimer: DISCLAIMER,
      };
    case "bearish":
      return {
        questionId,
        title: "What would make the outlook bearish",
        body: `Bearish confirmation below: ${ctx.bearishConfirm}`,
        bullets: [
          `Invalidation if: ${ctx.invalidation}`,
          conflicting[0] ? `Watch conflict: ${conflicting[0]}` : "Need clearer conflicting evidence",
          ctx.decisionReady ? `Current bias: ${ctx.decision.marketBias}` : "Bias withheld until decision-ready data",
        ],
        disclaimer: DISCLAIMER,
      };
    case "missing":
      return {
        questionId,
        title: "What evidence is missing",
        body: missing.length
          ? "These gaps keep confidence and permission constrained."
          : "No additional missing-data warnings are listed beyond current permission and freshness rules.",
        bullets: missing.length
          ? missing
          : [
            ctx.snapshot.status === "DELAYED" ? "Verified delayed data — treat readings as aged" : "Freshness currently acceptable for display",
            ctx.gateway.connectionStatus !== "connected" ? `Provider status: ${ctx.gateway.connectionStatus}` : "Provider connected",
          ],
        disclaimer: DISCLAIMER,
      };
    case "range": {
      if (symbol) return answerInstrumentStructure(symbol, ctx);
      const esStructure = structureFor(ctx, "ES");
      if (esStructure?.status === "ready" && esStructure.support && esStructure.resistance) {
        return {
          questionId,
          title: "Verified range levels",
          body: es
            ? `ES reference ${es.value}. Desk levels below use the verified candle range — not invented price targets.`
            : "ES reference unavailable. Range levels use verified candle evidence when present.",
          bullets: [
            `Support: ${esStructure.support.display}`,
            `Resistance: ${esStructure.resistance.display}`,
            ...esStructure.references.slice(0, 2).map((ref) => `${ref.label}: ${ref.display}`),
            `Bullish path: ${ctx.bullishConfirm}`,
            `Bearish path: ${ctx.bearishConfirm}`,
          ],
          disclaimer: DISCLAIMER,
        };
      }
      return {
        questionId,
        title: "Verified range levels",
        body: es
          ? `ES reference ${es.value}. Levels below are verified references from the current snapshot — not invented price targets.`
          : "ES reference unavailable. Range levels stay withheld.",
        bullets: [
          support ? `Support reference: ${support.value}${support.note ? ` (${support.note})` : ""}` : "Support reference unavailable",
          resistance ? `Resistance reference: ${resistance.value}${resistance.note ? ` (${resistance.note})` : ""}` : "Resistance reference unavailable",
          `Bullish path: ${ctx.bullishConfirm}`,
          `Bearish path: ${ctx.bearishConfirm}`,
        ],
        disclaimer: DISCLAIMER,
      };
    }
    case "age":
      return {
        questionId,
        title: "How old is the data",
        body: `Snapshot age: ${ctx.dataAge}. Provider status: ${ctx.gateway.connectionStatus}. Market status: ${ctx.snapshot.status}.`,
        bullets: [
          `As of: ${ctx.snapshot.asOf || "unavailable"}`,
          typeof ctx.gateway.dataAgeMs === "number"
            ? `Provider verification age: ${formatAgeFromMs(ctx.gateway.dataAgeMs)}`
            : "Provider verification age unavailable",
          ctx.snapshot.status === "DELAYED" || !ctx.decisionReady
            ? "Verified delayed data — do not treat as live"
            : "Within decision-display window when other evidence is complete",
          ...(instrumentNote ? [instrumentNote] : []),
        ],
        disclaimer: DISCLAIMER,
      };
    case "watch-next":
    default:
      return {
        questionId: "watch-next",
        title: "What to watch next",
        body: "Watch the next confirmation path, invalidation, and the next verified catalyst — not unverified premium levels.",
        bullets: [
          `Bullish confirmation: ${ctx.bullishConfirm}`,
          `Bearish confirmation: ${ctx.bearishConfirm}`,
          `Stand aside if: ${ctx.invalidation}`,
          ctx.snapshot.events[0]
            ? `Next verified catalyst: ${ctx.snapshot.events[0].time} · ${ctx.snapshot.events[0].name}`
            : "No verified catalyst schedule in window",
        ],
        disclaimer: DISCLAIMER,
      };
  }
}

/** Answer a free-form subscriber question using only verified context. */
export function answerAskBullseyeQuery(raw: string, ctx: AskBullseyeContext): AskBullseyeAnswer {
  const parsed = parseAskBullseyeQuery(raw);
  if (parsed.questionId === "help") return answerHelp(raw);
  return answerAskBullseye(parsed.questionId, ctx, parsed.symbol);
}
