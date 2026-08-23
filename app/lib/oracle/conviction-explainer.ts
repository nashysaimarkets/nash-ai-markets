import type { MarketSnapshot } from "../market-data.ts";
import type { MarketIntelligence } from "../market-intelligence-engine.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import { upcomingVerifiedEvents } from "../../terminal/lib/event-display.ts";

export type ConvictionRelation = "supports" | "opposes" | "neutral" | "unavailable" | "caution";

export type ConvictionFactor = {
  id: string;
  label: string;
  relation: ConvictionRelation;
  strength: "Low" | "Medium" | "High" | "Unavailable";
  explanation: string;
  whyItMatters: string;
  dataStatus: "Verified delayed" | "Unavailable" | "Incomplete";
};

export type ConvictionExplainerModel = {
  available: boolean;
  factors: ConvictionFactor[];
  methodology: string;
};

function quote(snapshot: MarketSnapshot, symbol: string) {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

function directionRelation(
  direction: "up" | "down" | "flat" | undefined,
  supportiveWhen: "up" | "down",
): ConvictionRelation {
  if (!direction) return "unavailable";
  if (direction === "flat") return "neutral";
  return direction === supportiveWhen ? "supports" : "opposes";
}

function strengthFromScore(score: number | null, verified: boolean): ConvictionFactor["strength"] {
  if (!verified || score == null) return "Unavailable";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function buildConvictionExplainer(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  verified: boolean;
  now?: number;
}): ConvictionExplainerModel {
  const methodology =
    "Educational factor breakdown from verified delayed prints and documented engine scores. Scenario weights are not calibrated win probabilities. Unavailable feeds stay unavailable.";
  const now = input.now ?? Date.now();
  const vix = quote(input.snapshot, "VIX");
  const dxy = quote(input.snapshot, "DXY");
  const us10 = quote(input.snapshot, "US10Y");
  const hasEvent = upcomingVerifiedEvents(input.snapshot.events, now, 1).length > 0;

  const factors: ConvictionFactor[] = [
    {
      id: "trend",
      label: "Trend",
      relation: !input.verified
        ? "unavailable"
        : input.intelligence.scores.trend >= 55
          ? "supports"
          : input.intelligence.scores.trend <= 45
            ? "opposes"
            : "neutral",
      strength: strengthFromScore(input.intelligence.scores.trend, input.verified),
      explanation: input.verified
        ? `Trend score ${Math.round(input.intelligence.scores.trend)}/100 from verified structure inputs.`
        : "Trend contribution withheld until verified decision inputs clear.",
      whyItMatters: "Trend agreement helps judge whether an observed lean has follow-through rather than noise.",
      dataStatus: input.verified ? "Verified delayed" : "Incomplete",
    },
    {
      id: "momentum",
      label: "Momentum",
      relation: !input.verified
        ? "unavailable"
        : input.intelligence.scores.marketSentiment >= 55
          ? "supports"
          : input.intelligence.scores.marketSentiment <= 45
            ? "opposes"
            : "neutral",
      strength: strengthFromScore(input.intelligence.scores.marketSentiment, input.verified),
      explanation: input.verified
        ? `Momentum-related engine score ${Math.round(input.intelligence.scores.marketSentiment)}/100. This is not advance/decline breadth.`
        : "Momentum contribution withheld until verification recovers.",
      whyItMatters: "Momentum context helps separate persistent pressure from a one-print bounce.",
      dataStatus: input.verified ? "Verified delayed" : "Incomplete",
    },
    {
      id: "volatility",
      label: "Volatility",
      relation: directionRelation(vix?.direction, "down"),
      strength: vix ? (vix.direction === "flat" ? "Low" : "Medium") : "Unavailable",
      explanation: vix
        ? `VIX is ${vix.direction === "down" ? "lower" : vix.direction === "up" ? "higher" : "unchanged"} on the latest verified print (${vix.value}).`
        : "No verified VIX print is available.",
      whyItMatters: "Falling volatility can ease risk conditions; rising volatility often restricts participation quality.",
      dataStatus: vix ? "Verified delayed" : "Unavailable",
    },
    {
      id: "dollar",
      label: "Dollar",
      relation: directionRelation(dxy?.direction, "down"),
      strength: dxy ? (dxy.direction === "flat" ? "Low" : "Medium") : "Unavailable",
      explanation: dxy
        ? `DXY is ${dxy.direction === "down" ? "softer" : dxy.direction === "up" ? "firmer" : "unchanged"} on the latest verified print (${dxy.value}).`
        : "No verified DXY print is available.",
      whyItMatters: "Dollar pressure can support or restrict risk appetite in equity-index futures context.",
      dataStatus: dxy ? "Verified delayed" : "Unavailable",
    },
    {
      id: "yields",
      label: "Yields",
      relation: directionRelation(us10?.direction, "down"),
      strength: us10 ? (us10.direction === "flat" ? "Low" : "Medium") : "Unavailable",
      explanation: us10
        ? `US 10-year yield is ${us10.direction === "down" ? "lower" : us10.direction === "up" ? "higher" : "unchanged"} (${us10.value}).`
        : "No verified US 10-year yield print is available.",
      whyItMatters: "Yield moves alter discount-rate pressure and can confirm or conflict with equity lean.",
      dataStatus: us10 ? "Verified delayed" : "Unavailable",
    },
    {
      id: "breadth",
      label: "Breadth",
      relation: "unavailable",
      strength: "Unavailable",
      explanation: "No verified advance/decline breadth feed is connected.",
      whyItMatters: "Breadth shows how widely participation confirms an index move — unavailable here until a verified feed exists.",
      dataStatus: "Unavailable",
    },
    {
      id: "event-risk",
      label: "Event risk",
      relation: hasEvent ? "caution" : "neutral",
      strength: hasEvent ? "Medium" : "Low",
      explanation: hasEvent
        ? "A verified upcoming calendar release is approaching."
        : "No upcoming verified medium/high-impact catalyst is listed in the current window.",
      whyItMatters: "Scheduled releases can invalidate otherwise constructive short-term structure.",
      dataStatus: "Verified delayed",
    },
    {
      id: "data-completeness",
      label: "Data completeness",
      relation: input.verified ? "supports" : "caution",
      strength: input.verified ? "High" : "Unavailable",
      explanation: input.verified
        ? "Decision-ready verified inputs are present for the current briefing window."
        : "Confirmation data is incomplete, so conviction stays limited.",
      whyItMatters: "Incomplete data is itself a risk factor — the companion fails closed rather than inventing certainty.",
      dataStatus: input.verified ? "Verified delayed" : "Incomplete",
    },
  ];

  return {
    available: input.verified || factors.some((item) => item.dataStatus === "Verified delayed"),
    factors,
    methodology,
  };
}
