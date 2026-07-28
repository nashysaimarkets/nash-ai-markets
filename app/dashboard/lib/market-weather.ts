import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { SessionClockReading, SessionPhase } from "../../terminal/lib/session-clock.ts";
import type { DecisionDeskModel } from "./decision-desk.ts";

export type WeatherTone = "green" | "amber" | "red" | "blue";

export type MarketWeatherModel = {
  verified: boolean;
  trend: { label: "Bullish" | "Neutral" | "Bearish"; tone: WeatherTone; detail: string };
  volatility: { label: "Low" | "Normal" | "Elevated"; tone: WeatherTone; detail: string };
  momentum: { label: "Improving" | "Weakening" | "Mixed"; tone: WeatherTone; detail: string };
  breadth: { label: "Strong" | "Neutral" | "Weak"; tone: WeatherTone; detail: string };
  tradingConditions: {
    label: "Excellent" | "Good" | "Average" | "Poor";
    tone: WeatherTone;
    detail: string;
  };
};

export type OpportunityRadarModel = {
  available: boolean;
  headline: string;
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  direction: "Long" | "Short" | "Stand Aside";
  probability: "High" | "Medium" | "Low" | "None";
  preferredZone: string;
  targetArea: string;
  invalidation: string;
  riskLevel: string;
  reasoning: string;
};

export type MarketScoreModel = {
  score: number | null;
  label: string;
  tone: WeatherTone;
  factors: Array<{ label: string; detail: string; tone: WeatherTone }>;
  summary: string;
};

export type DeskGreeting = {
  salutation: string;
  name: string;
  subtitle: string;
};

const NO_OPPORTUNITY = "No verified opportunity currently available";

function firstName(memberName: string): string {
  const cleaned = memberName.trim().split(/[@\s._-]+/).filter(Boolean)[0] ?? "trader";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function dayPart(phase: SessionPhase, now = new Date()): "morning" | "afternoon" | "evening" {
  if (phase === "premarket") return "morning";
  if (phase === "afterhours" || phase === "weekend" || phase === "holiday-closed") return "evening";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .find((part) => part.type === "hour")?.value ?? "12",
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Dynamic trader greeting from session clock — presentation only. */
export function buildDeskGreeting(memberName: string, session: SessionClockReading, now = new Date()): DeskGreeting {
  const name = firstName(memberName);
  const part = dayPart(session.phase, now);
  const salutation = part === "morning"
    ? "Good morning"
    : part === "afternoon"
      ? "Good afternoon"
      : "Good evening";

  if (session.phase === "premarket") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Markets are preparing. US cash session opens in ${session.countdownLabel}.`
        : "Markets are preparing for the US cash open.",
    };
  }
  if (session.phase === "rth") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Cash session is open. Regular hours wrap in ${session.countdownLabel}.`
        : "US cash session is open — prepare with delayed verified feeds.",
    };
  }
  if (session.phase === "afterhours") {
    return {
      salutation,
      name,
      subtitle: "Post-market review is ready. Use delayed prints for education, not live execution.",
    };
  }
  if (session.phase === "weekend") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Weekend desk mode. Next pre-market window in ${session.countdownLabel}.`
        : "Weekend desk mode — review structure without forcing a trade.",
    };
  }
  return {
    salutation,
    name,
    subtitle: "Cash session is closed. Keep preparation educational until verified inputs reopen.",
  };
}

function momentumFromScores(intelligence: MarketIntelligence, verified: boolean): MarketWeatherModel["momentum"] {
  if (!verified) {
    return {
      label: "Mixed",
      tone: "blue",
      detail: "Momentum stays unmarked until verified trend and breadth inputs clear.",
    };
  }
  const trend = intelligence.scores.trend;
  const breadth = intelligence.scores.marketSentiment;
  const risk = intelligence.scores.riskOnRiskOff;
  const lean = (trend - 50) + (breadth - 50) * 0.6 + (risk - 50) * 0.4;
  if (lean >= 12) {
    return {
      label: "Improving",
      tone: "green",
      detail: "Trend, breadth, and risk appetite lean constructive on verified scores.",
    };
  }
  if (lean <= -12) {
    return {
      label: "Weakening",
      tone: "red",
      detail: "Trend, breadth, or risk appetite is fading on verified scores.",
    };
  }
  return {
    label: "Mixed",
    tone: "amber",
    detail: "Verified drivers disagree — momentum is mixed, not decisive.",
  };
}

function breadthFromScore(score: number, verified: boolean): MarketWeatherModel["breadth"] {
  if (!verified) {
    return {
      label: "Neutral",
      tone: "blue",
      detail: "Breadth is withheld while verified sentiment inputs are incomplete.",
    };
  }
  if (score >= 58) {
    return { label: "Strong", tone: "green", detail: `Breadth / sentiment score ${score}/100 leans constructive.` };
  }
  if (score <= 42) {
    return { label: "Weak", tone: "red", detail: `Breadth / sentiment score ${score}/100 leans cautious.` };
  }
  return { label: "Neutral", tone: "blue", detail: `Breadth / sentiment score ${score}/100 is balanced.` };
}

function tradingConditions(
  desk: DecisionDeskModel,
  verified: boolean,
): MarketWeatherModel["tradingConditions"] {
  if (!verified) {
    return {
      label: "Poor",
      tone: "red",
      detail: "Trading conditions stay poor until the verified decision window clears.",
    };
  }
  const score = desk.confidence.score ?? 0;
  const volPenalty = desk.volatility.label === "Elevated" ? 12 : desk.volatility.label === "Low" ? 0 : 4;
  const adjusted = score - volPenalty;
  if (adjusted >= 75 && desk.opportunity.available) {
    return { label: "Excellent", tone: "green", detail: "Verified confidence and opportunity alignment are strong." };
  }
  if (adjusted >= 58) {
    return { label: "Good", tone: "green", detail: "Conditions support selective participation with clear invalidation." };
  }
  if (adjusted >= 40) {
    return { label: "Average", tone: "amber", detail: "Average conditions — size down and wait for cleaner confirmation." };
  }
  return { label: "Poor", tone: "red", detail: "Poor conditions — favour stand-aside over forced participation." };
}

export function buildMarketWeather(input: {
  desk: DecisionDeskModel;
  intelligence: MarketIntelligence;
}): MarketWeatherModel {
  const { desk, intelligence } = input;
  const verified = desk.verified;

  const trend: MarketWeatherModel["trend"] = !verified
    ? {
      label: "Neutral",
      tone: "blue",
      detail: "Trend bias stays Neutral until verified decision inputs clear.",
    }
    : {
      label: desk.marketBias.label,
      tone: desk.marketBias.tone === "bull" ? "green" : desk.marketBias.tone === "bear" ? "red" : "blue",
      detail: desk.trend.detail,
    };

  const volatility: MarketWeatherModel["volatility"] = {
    label: desk.volatility.label,
    tone: desk.volatility.label === "Elevated"
      ? "red"
      : desk.volatility.label === "Low"
        ? "green"
        : "amber",
    detail: desk.volatility.detail,
  };

  return {
    verified,
    trend,
    volatility,
    momentum: momentumFromScores(intelligence, verified),
    breadth: breadthFromScore(intelligence.scores.marketSentiment, verified),
    tradingConditions: tradingConditions(desk, verified),
  };
}

function starRating(desk: DecisionDeskModel): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!desk.verified || !desk.opportunity.available) return 0;
  const score = desk.confidence.score ?? 0;
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

function probability(desk: DecisionDeskModel): OpportunityRadarModel["probability"] {
  if (!desk.verified || !desk.opportunity.available) return "None";
  const band = desk.confidence.band;
  if (band === "Strong" || band === "High") return "High";
  if (band === "Moderate") return "Medium";
  return "Low";
}

export function buildOpportunityRadar(desk: DecisionDeskModel): OpportunityRadarModel {
  if (!desk.verified || !desk.opportunity.available) {
    return {
      available: false,
      headline: NO_OPPORTUNITY,
      rating: 0,
      direction: "Stand Aside",
      probability: "None",
      preferredZone: "No preferred zone until a verified setup clears.",
      targetArea: "No target until a verified setup clears.",
      invalidation: "Not applicable while standing aside.",
      riskLevel: desk.opportunity.riskLevel,
      reasoning: desk.tradeThesis,
    };
  }

  const direction: OpportunityRadarModel["direction"] =
    /long/i.test(desk.opportunity.preferredDirection)
      ? "Long"
      : /short/i.test(desk.opportunity.preferredDirection)
        ? "Short"
        : "Stand Aside";

  return {
    available: true,
    headline: desk.opportunity.headline,
    rating: starRating(desk),
    direction,
    probability: probability(desk),
    preferredZone: desk.opportunity.entryZone,
    targetArea: desk.opportunity.targetArea,
    invalidation: desk.opportunity.invalidation,
    riskLevel: desk.opportunity.riskLevel,
    reasoning: desk.tradeThesis,
  };
}

export function buildMarketScore(input: {
  desk: DecisionDeskModel;
  intelligence: MarketIntelligence;
  weather: MarketWeatherModel;
}): MarketScoreModel {
  const { desk, intelligence, weather } = input;
  if (!desk.verified || desk.confidence.score == null) {
    return {
      score: null,
      label: "Today's Market Score",
      tone: "blue",
      summary: "Score stays blank until verified trend, breadth, momentum, and volatility inputs clear — blank is not bearish.",
      factors: [
        { label: "Trend", detail: weather.trend.detail, tone: "blue" },
        { label: "Breadth", detail: weather.breadth.detail, tone: "blue" },
        { label: "Momentum", detail: weather.momentum.detail, tone: "blue" },
        { label: "Volatility", detail: weather.volatility.detail, tone: "blue" },
        { label: "Confirmation", detail: desk.confidence.factors.find((f) => f.label === "Confirmation")?.detail ?? "Confirmation closed.", tone: "blue" },
      ],
    };
  }

  const score = Math.round(desk.confidence.score || intelligence.scores.bullseyeConfidence || 0);
  const tone: WeatherTone = score >= 65 ? "green" : score >= 40 ? "amber" : "red";

  return {
    score,
    label: "Today's Market Score",
    tone,
    summary: "Based only on verified Bullseye inputs — educational desk score, not a guarantee.",
    factors: [
      { label: "Trend", detail: weather.trend.detail, tone: weather.trend.tone },
      { label: "Breadth", detail: weather.breadth.detail, tone: weather.breadth.tone },
      { label: "Momentum", detail: weather.momentum.detail, tone: weather.momentum.tone },
      { label: "Volatility", detail: weather.volatility.detail, tone: weather.volatility.tone },
      {
        label: "Confirmation",
        detail: desk.confidence.factors.find((f) => f.label === "Confirmation")?.detail
          ?? "Confirmation status drawn from the verified trade plan.",
        tone: desk.opportunity.available ? "green" : "amber",
      },
    ],
  };
}
