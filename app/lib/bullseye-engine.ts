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
  missionBrief: string;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(value)));

const primaryLevel = (
  levels: MarketLevel[],
  type: MarketLevel["type"],
  fallback: string,
) => {
  const candidates = levels.filter((level) => level.type === type);
  const primaryLabel = type === "resistance" ? "R1" : type === "support" ? "S1" : "PV";
  const explicit = candidates.find((level) => level.label.trim().toUpperCase() === primaryLabel);
  if (explicit) return explicit.value;
  const ordered = candidates.map((level) => ({
    level,
    numeric: Number.parseFloat(level.value.replaceAll(",", "")),
  })).filter((entry) => Number.isFinite(entry.numeric)).sort((left, right) =>
    type === "support" ? right.numeric - left.numeric : left.numeric - right.numeric,
  );
  return ordered[0]?.level.value ?? candidates[0]?.value ?? fallback;
};

export function runBullseyeEngine(snapshot: MarketSnapshot): BullseyeResult {
  if (snapshot.status !== "LIVE" && snapshot.status !== "DELAYED") {
    return {
      score: 0,
      confidence: 0,
      weather: "STORMY",
      bias: "UNAVAILABLE",
      risk: "HIGH",
      bullProbability: 0,
      bearProbability: 0,
      noTradeProbability: 100,
      dna: ["VERIFIED DATA UNAVAILABLE", "NO-TRADE"],
      bullTrigger: "Unavailable",
      bearTrigger: "Unavailable",
      bullInvalidation: "Unavailable",
      bearInvalidation: "Unavailable",
      standAside: "Stand aside until verified current market data is available.",
      riskWindowPrep: "Scheduled event data is unavailable.",
      missionBrief: "Verified current market data is unavailable. No directional trading guidance has been generated.",
    };
  }

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

  const resistance = primaryLevel(snapshot.levels, "resistance", "mapped resistance");
  const pivot = primaryLevel(snapshot.levels, "pivot", "the session pivot");
  const support = primaryLevel(snapshot.levels, "support", "mapped support");
  const primaryEvent = snapshot.events[0];
  const riskWindow = primaryEvent
    ? `${primaryEvent.time}${/\bUK$/i.test(primaryEvent.time.trim()) ? "" : " UK"} — ${primaryEvent.name}`
    : "No scheduled risk window supplied";

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
    missionBrief: `${leadingCase}. ${snapshot.summary}`,
  };
}
