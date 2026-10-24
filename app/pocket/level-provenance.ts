export type ProvenanceLevel = { kind: string; label: string; price: string; placement?: string; provenance?: string };
export type LevelProvenance = {
  kind: string; price: string; method: "USER_VERIFIED" | "AI_DETECTED" | "AI_CANDIDATE";
  confidence: "HIGH" | "MEDIUM" | "LOW"; precision: "EXACT" | "APPROXIMATE" | "POSITION_CHECKED";
  source: "PRIMARY_CHART"; evidence: string;
};

export function deriveLevelProvenance(level: ProvenanceLevel, anchorCount: number): LevelProvenance {
  if (level.placement === "IMAGE_AXIS") return {
    kind: level.kind, price: level.price, method: "AI_CANDIDATE", confidence: "LOW",
    precision: "POSITION_CHECKED", source: "PRIMARY_CHART",
    evidence: "Price position checked against the chart's printed scale. Support or resistance remains an unconfirmed suggestion.",
  };
  if (level.provenance === "UNVERIFIED") return {
    kind: level.kind, price: level.price, method: "AI_CANDIDATE", confidence: "LOW",
    precision: "APPROXIMATE", source: "PRIMARY_CHART",
    evidence: "Unconfirmed model price suggestion. Its position has not been checked against the chart.",
  };
  const verified = /USER VERIFIED/i.test(level.label);
  const numeric = /^-?\d[\d,]*(?:\.\d+)?$/.test(level.price.trim());
  const confidence = verified ? "HIGH" : anchorCount >= 2 && numeric ? "MEDIUM" : "LOW";
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
