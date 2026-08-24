export type ProvenanceLevel = { kind: string; label: string; price: string };
export type LevelProvenance = {
  kind: string; price: string; method: "USER_VERIFIED" | "AI_DETECTED";
  confidence: "HIGH" | "MEDIUM" | "LOW"; precision: "EXACT" | "APPROXIMATE";
  source: "PRIMARY_CHART"; evidence: string;
};

export function deriveLevelProvenance(level: ProvenanceLevel, anchorCount: number): LevelProvenance {
  const verified = /USER VERIFIED/i.test(level.label);
  const numeric = /^-?\d[\d,]*(?:\.\d+)?$/.test(level.price.trim());
  const confidence = verified ? "HIGH" : anchorCount >= 3 && numeric ? "HIGH" : anchorCount >= 2 && numeric ? "MEDIUM" : "LOW";
  return {
    kind: level.kind,
    price: level.price,
    method: verified ? "USER_VERIFIED" : "AI_DETECTED",
    confidence,
    precision: numeric && (verified || anchorCount >= 2) ? "EXACT" : "APPROXIMATE",
    source: "PRIMARY_CHART",
    evidence: verified ? "Trader-confirmed correction replay." : anchorCount >= 2 ? `Price aligned to ${anchorCount} readable scale anchors and visible structure.` : "Visible reaction area; price scale calibration is limited.",
  };
}
