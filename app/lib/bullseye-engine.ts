import type { MarketLevel, MarketSnapshot } from "./market-data";

export type BullseyeResult = {
  score: number;
  confidence: number;
  weather: "CLEAR" | "MIXED" | "STORMY";
  bias: string;
  risk: MarketSnapshot["risk"];
  bullProbability: number;
  bearProbability: number;
  noTradeProbability: number;
  dna: string[];
  bullTrigger: string;
  bearTrigger: string;
  bullInvalidation: string;
  bearInvalidation: string;
  standAside: string;
  riskWindowPrep: string;
  optionsApproach: string;
  missionBrief: string;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(value)));

const firstLevel = (
  levels: MarketLevel[],
  type: MarketLevel["type"],
  fallback: string,
) => levels.find((level) => level.type === type)?.value ?? fallback;

export function runBullseyeEngine(snapshot: MarketSnapshot): BullseyeResult {
  const values = Object.values(snapshot.evidence).filter(Number.isFinite);
  const score = clamp(
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 50,
  );
  const dataPenalty =
    snapshot.status === "LIVE"
      ? 0
      : snapshot.status === "DELAYED"
        ? 8
        : snapshot.status === "PREVIEW"
          ? 25
          : 35;
  const confidence = clamp(55 + Math.abs(score - 50) - dataPenalty, 20, 88);
  const riskPenalty =
    snapshot.risk === "HIGH"
      ? 14
      : snapshot.risk === "ELEVATED"
        ? 9
        : snapshot.risk === "MODERATE"
          ? 5
          : 2;
  const noTradeProbability = clamp(
    30 + riskPenalty - Math.abs(score - 50) * 0.8,
    18,
    48,
  );
  const directionalProbability = 100 - noTradeProbability;
  const bullProbability = Math.round(
    directionalProbability * (clamp(score, 20, 80) / 100),
  );
  const bearProbability = directionalProbability - bullProbability;

  const resistance = firstLevel(snapshot.levels, "resistance", "mapped resistance");
  const pivot = firstLevel(snapshot.levels, "pivot", "the session pivot");
  const support = firstLevel(snapshot.levels, "support", "mapped support");
  const primaryEvent = snapshot.events[0];
  const riskWindow = primaryEvent
    ? `${primaryEvent.time} UK — ${primaryEvent.name}`
    : "No scheduled risk window supplied";

  const verifiedData = snapshot.status === "LIVE" || snapshot.status === "DELAYED";
  const leadingCase =
    bullProbability > bearProbability
      ? `Bull case leads ${bullProbability}% to ${bearProbability}%`
      : bearProbability > bullProbability
        ? `Bear case leads ${bearProbability}% to ${bullProbability}%`
        : "Bull and bear cases are evenly balanced";

  return {
    score,
    confidence,
    weather:
      snapshot.risk === "HIGH"
        ? "STORMY"
        : snapshot.risk === "LOW"
          ? "CLEAR"
          : "MIXED",
    bias: snapshot.bias,
    risk: snapshot.risk,
    bullProbability,
    bearProbability,
    noTradeProbability,
    dna: [snapshot.bias, `${snapshot.risk} RISK`, `${snapshot.status} DATA`],
    bullTrigger: `Acceptance above ${resistance} with improving participation`,
    bearTrigger: `Sustained loss of ${pivot}, then pressure toward ${support}`,
    bullInvalidation: `Rejection back below ${resistance} without follow-through`,
    bearInvalidation: `Recovery and acceptance back above ${pivot}`,
    standAside:
      "Stand aside when price repeatedly crosses the pivot without follow-through or participation.",
    riskWindowPrep: `Reduce size before ${riskWindow}; wait for the first reaction to settle before reassessing.`,
    optionsApproach:
      snapshot.risk === "HIGH" || snapshot.risk === "ELEVATED"
        ? "If trading options, favour defined-risk spreads; avoid uncovered short premium and chasing inflated volatility."
        : "If trading options, use defined risk, pre-set maximum loss and only act after the mapped trigger confirms.",
    missionBrief: verifiedData
      ? `${leadingCase}. ${snapshot.summary}`
      : `${leadingCase}, but the feed is ${snapshot.status}. Treat all displayed levels as demonstration data until independently verified.`,
  };
}
