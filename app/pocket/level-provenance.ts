import type { LevelEvidenceSource } from "./pocket-derived-evidence";

export type ProvenanceLevel = { kind: string; label: string; price: string; source?: LevelEvidenceSource };
export type LevelProvenance = {
  kind: string; price: string; method: "USER_VERIFIED" | "AI_DETECTED";
  confidence: "HIGH" | "MEDIUM" | "LOW"; precision: "EXACT" | "APPROXIMATE";
  source: "PRIMARY_CHART" | "CONTEXT_CHART" | "LEVEL_LAB_CHART" | "USER_VERIFIED"; evidence: string;
};

export function deriveLevelProvenance(level: ProvenanceLevel, anchorCount: number): LevelProvenance {
  const verified = /USER VERIFIED/i.test(level.label);
  const numeric = /^-?\d[\d,]*(?:\.\d+)?$/.test(level.price.trim());
  const levelLab = level.source === "LEVEL_LAB";
  const context = level.source === "CONTEXT";
  const primaryScaleVerified = !levelLab && !context && anchorCount >= 2;
  const confidence = verified ? "HIGH" : (levelLab || primaryScaleVerified) && numeric ? "MEDIUM" : "LOW";
  const source = verified || level.source === "USER_VERIFIED"
    ? "USER_VERIFIED"
    : levelLab
      ? "LEVEL_LAB_CHART"
      : context
        ? "CONTEXT_CHART"
        : "PRIMARY_CHART";
  return {
    kind: level.kind,
    price: level.price,
    method: verified ? "USER_VERIFIED" : "AI_DETECTED",
    confidence,
    precision: numeric && (verified || levelLab || primaryScaleVerified) ? "EXACT" : "APPROXIMATE",
    source,
    evidence: verified
      ? "Trader-confirmed correction replay."
      : levelLab
        ? "Price validated inside the independent Level Lab scan; its pixel geometry is kept separate from the primary chart."
        : context
          ? "Price came from the context chart; primary-chart scale anchors are not reused as evidence."
          : primaryScaleVerified
            ? `Price aligned to ${anchorCount} readable scale anchors and visible structure.`
            : "Visible reaction area; price scale calibration is limited.",
  };
}
