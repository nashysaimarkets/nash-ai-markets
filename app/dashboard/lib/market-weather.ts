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
  descriptor: "Poor" | "Average" | "Good" | "Excellent" | "Awaiting inputs";
  tone: WeatherTone;
  factors: Array<{ label: string; detail: string; tone: WeatherTone }>;
  summary: string;
};

export type DeskGreeting = {
  salutation: string;
  name: string | null;
  subtitle: string;
  /** Session-aware Morning Brief hero clause (navigation label stays Morning Brief). */
  briefHeadline: string;
};

const NO_OPPORTUNITY = "No verified opportunity currently available";

/** Prefer a real first name; never treat a single initial as a greeting name. */
export function preferredGreetingName(memberName: string): string | null {
  const raw = memberName.trim();
  if (!raw || raw.toLowerCase() === "member") return null;

  const fromPreferred = raw.split(/[\s,]+/).map((part) => part.trim()).find(Boolean) ?? "";
  const token = fromPreferred.replace(/[^A-Za-z'’-]/g, "");
  if (token.length < 2) return null;
  if (!/^[A-Za-z]/.test(token)) return null;
  return token.charAt(0).toUpperCase() + token.slice(1);
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
  const name = preferredGreetingName(memberName);
  const part = dayPart(session.phase, now);
  const salutation = part === "morning"
    ? "Good morning"
    : part === "afternoon"
      ? "Good afternoon"
      : "Good evening";

  const briefHeadline =
    session.phase === "premarket"
      ? "Here is today’s pre-market briefing."
      : session.phase === "rth"
        ? "Here is today’s session update."
        : "Here is today’s post-market review.";

  if (session.phase === "premarket") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Markets are preparing. US cash session opens in ${session.countdownLabel}.`
        : "Markets are preparing for the US cash open.",
      briefHeadline,
    };
  }
  if (session.phase === "rth") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Cash session is open. Regular hours wrap in ${session.countdownLabel}.`
        : "US cash session is open — prepare with delayed verified feeds.",
      briefHeadline,
    };
  }
  if (session.phase === "afterhours") {
    return {
      salutation,
      name,
      subtitle: "Post-market review is ready. Use delayed prints for education, not live execution.",
      briefHeadline,
    };
  }
  if (session.phase === "weekend") {
    return {
      salutation,
      name,
      subtitle: session.countdownLabel
        ? `Weekend desk mode. Next pre-market window in ${session.countdownLabel}.`
        : "Weekend desk mode — review structure without forcing a trade.",
      briefHeadline,
    };
  }
  return {
    salutation,
    name,
    subtitle: "Cash session is closed. Keep preparation educational until verified inputs reopen.",
    briefHeadline,
  };
}

function titleCaseRisk(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "Unrated";
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function customerCopy(value: string): string {
  return value
    .replaceAll("CRITICAL_INPUT_MISSING", "Awaiting full confirmation from verified inputs")
    .replaceAll("Required market inputs are incomplete", "Awaiting full confirmation from verified inputs")
    .replaceAll("required market inputs are incomplete", "Awaiting full confirmation from verified inputs")
    .replaceAll("Not confirmed", "Awaiting confirmation")
    .replaceAll("Stand aside", "Stand Aside")
    .replaceAll("stand aside", "Stand Aside")
    .replace(/\bmedium\b/g, "Medium")
    .replace(/\blow\b/g, "Low")
    .replace(/\bhigh\b/g, "High")
    .replace(/\bNULL\b/g, "missing")
    .replace(/\bUndefined\b/g, "missing")
    .replace(/\bundefined\b/g, "missing")
    .replace(/\bUnavailable\b/g, "not yet confirmed from verified feeds");
}

function momentumFromScores(intelligence: MarketIntelligence, verified: boolean): MarketWeatherModel["momentum"] {
  if (!verified) {
    return {
      label: "Mixed",
      tone: "blue",
      detail: "Awaiting verified momentum inputs.",
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
      detail: "Verified drivers lean constructive.",
    };
  }
  if (lean <= -12) {
    return {
      label: "Weakening",
      tone: "red",
      detail: "Verified drivers lean softer.",
    };
  }
  return {
    label: "Mixed",
    tone: "amber",
    detail: "Verified drivers disagree.",
  };
}

function breadthFromScore(score: number, verified: boolean): MarketWeatherModel["breadth"] {
  if (!verified) {
    return {
      label: "Neutral",
      tone: "blue",
      detail: "Awaiting verified breadth inputs.",
    };
  }
  if (score >= 58) {
    return { label: "Strong", tone: "green", detail: "Breadth leans constructive." };
  }
  if (score <= 42) {
    return { label: "Weak", tone: "red", detail: "Breadth leans cautious." };
  }
  return { label: "Neutral", tone: "blue", detail: "Breadth is balanced." };
}

function tradingConditions(
  desk: DecisionDeskModel,
  verified: boolean,
): MarketWeatherModel["tradingConditions"] {
  if (!verified) {
    return {
      label: "Poor",
      tone: "red",
      detail: "Conditions closed until verification clears.",
    };
  }
  const score = desk.confidence.score ?? 0;
  const volPenalty = desk.volatility.label === "Elevated" ? 12 : desk.volatility.label === "Low" ? 0 : 4;
  const adjusted = score - volPenalty;
  if (adjusted >= 75 && desk.opportunity.available) {
    return { label: "Excellent", tone: "green", detail: "Confidence and setup alignment are strong." };
  }
  if (adjusted >= 58) {
    return { label: "Good", tone: "green", detail: "Selective participation is supported." };
  }
  if (adjusted >= 40) {
    return { label: "Average", tone: "amber", detail: "Average conditions — stay selective." };
  }
  return { label: "Poor", tone: "red", detail: "Favour Stand Aside over forced trades." };
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
      detail: "Awaiting verified trend inputs.",
    }
    : {
      label: desk.marketBias.label,
      tone: desk.marketBias.tone === "bull" ? "green" : desk.marketBias.tone === "bear" ? "red" : "blue",
      detail: desk.marketBias.label === "Bullish"
        ? "Bias leans higher on verified inputs."
        : desk.marketBias.label === "Bearish"
          ? "Bias leans lower on verified inputs."
          : "Bias is balanced on verified inputs.",
    };

  const volatility: MarketWeatherModel["volatility"] = {
    label: desk.volatility.label,
    tone: desk.volatility.label === "Elevated"
      ? "red"
      : desk.volatility.label === "Low"
        ? "green"
        : "amber",
    detail: desk.volatility.label === "Elevated"
      ? "Ranges are expanded — stay selective."
      : desk.volatility.label === "Low"
        ? "Ranges are compressed."
        : "Volatility is in a normal band.",
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
    const standAsideReason = customerCopy(
      desk.confidence.factors.find((factor) => factor.label === "Missing inputs")?.detail
        ?? desk.opportunity.entryZone
        ?? "Awaiting a verified high-probability setup.",
    );
    return {
      available: false,
      headline: NO_OPPORTUNITY,
      rating: 0,
      direction: "Stand Aside",
      probability: "None",
      preferredZone: "No preferred zone while no verified setup is active",
      targetArea: "No target while no verified setup is active",
      invalidation: "Not applicable while Stand Aside",
      riskLevel: titleCaseRisk(desk.opportunity.riskLevel),
      reasoning: standAsideReason,
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
    headline: customerCopy(desk.opportunity.headline),
    rating: starRating(desk),
    direction,
    probability: probability(desk),
    preferredZone: customerCopy(desk.opportunity.entryZone),
    targetArea: customerCopy(desk.opportunity.targetArea),
    invalidation: customerCopy(desk.opportunity.invalidation),
    riskLevel: titleCaseRisk(desk.opportunity.riskLevel),
    reasoning: customerCopy(
      `${desk.opportunity.headline}. ${desk.opportunity.preferredDirection} with ${desk.opportunity.riskLevel} risk.`,
    ),
  };
}

function conditionsDescriptor(score: number | null, verified: boolean): MarketScoreModel["descriptor"] {
  if (!verified || score == null) return "Awaiting inputs";
  if (score >= 75) return "Excellent";
  if (score >= 58) return "Good";
  if (score >= 40) return "Average";
  return "Poor";
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
      label: "Trading Conditions Score",
      descriptor: "Awaiting inputs",
      tone: "blue",
      summary: "Measures the quality of current trading conditions — not a forecast and not the probability of market direction.",
      factors: [
        { label: "Trend", detail: weather.trend.detail, tone: "blue" },
        { label: "Breadth", detail: weather.breadth.detail, tone: "blue" },
        { label: "Momentum", detail: weather.momentum.detail, tone: "blue" },
        { label: "Volatility", detail: weather.volatility.detail, tone: "blue" },
        { label: "Confirmation", detail: "Confirmation closed until verified inputs clear.", tone: "blue" },
      ],
    };
  }

  const score = Math.round(desk.confidence.score || intelligence.scores.bullseyeConfidence || 0);
  const descriptor = conditionsDescriptor(score, true);
  const tone: WeatherTone = descriptor === "Excellent" || descriptor === "Good"
    ? "green"
    : descriptor === "Average"
      ? "amber"
      : "red";

  return {
    score,
    label: "Trading Conditions Score",
    descriptor,
    tone,
    summary: "Measures the quality of current trading conditions — not a forecast and not the probability of market direction.",
    factors: [
      { label: "Trend", detail: weather.trend.detail, tone: weather.trend.tone },
      { label: "Breadth", detail: weather.breadth.detail, tone: weather.breadth.tone },
      { label: "Momentum", detail: weather.momentum.detail, tone: weather.momentum.tone },
      { label: "Volatility", detail: weather.volatility.detail, tone: weather.volatility.tone },
      {
        label: "Confirmation",
        detail: desk.opportunity.available
          ? "Setup confirmation is active."
          : "Awaiting confirmation for a verified setup.",
        tone: desk.opportunity.available ? "green" : "amber",
      },
    ],
  };
}
