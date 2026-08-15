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
  if (phase === "afterhours") return "evening";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })
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
