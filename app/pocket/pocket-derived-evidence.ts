export type LevelEvidenceSource = "PRIMARY" | "CONTEXT" | "LEVEL_LAB" | "USER_VERIFIED";

export type DerivedEvidenceInvalidation = "CONTEXT_REPLACED" | "PRIMARY_STRUCTURE_CHANGED";

type HigherTimeframeEvidence = {
  provided: boolean;
  timeframe: string;
  direction: string;
  alignment: string;
  summary: string;
};

type DerivedChartEvidence = {
  combinedBattlefield?: unknown;
  contextBattlefield?: unknown | null;
  contextContribution?: unknown;
  higherTimeframe: HigherTimeframeEvidence;
};

export function levelEvidenceSourceLabel(source: LevelEvidenceSource | undefined) {
  if (source === "CONTEXT") return "CONTEXT CHART";
  if (source === "LEVEL_LAB") return "LEVEL LAB CHART";
  if (source === "USER_VERIFIED") return "USER VERIFIED";
  return "PRIMARY CHART";
}

/**
 * Derived multi-chart evidence is valid only for the exact image pair and
 * primary structure used by the analysis that produced it.
 */
export function invalidateDerivedChartEvidence<T extends DerivedChartEvidence>(
  analysis: T,
  reason: DerivedEvidenceInvalidation,
): T {
  const withoutCombinedEvidence = {
    ...analysis,
    combinedBattlefield: undefined,
    contextContribution: undefined,
  };

  if (reason === "PRIMARY_STRUCTURE_CHANGED") return withoutCombinedEvidence as T;

  return {
    ...withoutCombinedEvidence,
    contextBattlefield: null,
    higherTimeframe: {
      ...analysis.higherTimeframe,
      provided: false,
      timeframe: "",
      direction: "UNKNOWN",
      alignment: "NOT_PROVIDED",
      summary: "",
    },
  } as T;
}
