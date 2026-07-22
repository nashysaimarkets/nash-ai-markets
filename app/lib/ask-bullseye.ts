import type { MarketSnapshot } from "./market-data.ts";
import type { MarketIntelligence } from "./market-intelligence-engine.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";
import type { TradePlan } from "./structured-trade-planner.ts";
import type { MarketGatewayStatus } from "./live-market-gateway.ts";
import type { MarketDeskSignals } from "./market-desk-signals.ts";
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
];

export type AskBullseyeAnswer = {
  questionId: string;
  title: string;
  body: string;
  bullets: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "Deterministic educational market intelligence from verified application evidence only. Not personalised financial advice.";

function esQuote(snapshot: MarketSnapshot) {
  return snapshot.quotes.find((q) => q.symbol === "ES");
}

function supportResistance(snapshot: MarketSnapshot) {
  const support = snapshot.levels.find((level) => level.type === "support");
  const resistance = snapshot.levels.find((level) => level.type === "resistance");
  return { support, resistance };
}

function driverLabel(item: { factor: string } | string): string {
  return typeof item === "string" ? item : item.factor;
}

function warningLabel(item: { code: string; field?: string } | string): string {
  if (typeof item === "string") return item;
  return item.field ? `${item.code} (${item.field})` : item.code;
}

export function answerAskBullseye(
  questionId: string,
  ctx: AskBullseyeContext,
): AskBullseyeAnswer {
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
    case "range":
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
