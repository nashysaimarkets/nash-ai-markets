export type LiquiditySide = "buy-side" | "sell-side";
export type LiquidityEvidenceKind = "equal-highs" | "equal-lows" | "rejection" | "sweep-reclaim";
export type LiquidityStatus = "VERIFIED" | "AMBIGUOUS" | "BLOCKED";

export type LiquidityEvidence = {
  kind: LiquidityEvidenceKind;
  side: LiquiditySide;
  x: number;
  y: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type LiquidityInput = {
  chartReadability: "CLEAR" | "PARTIAL" | "POOR";
  candlesReadable: boolean;
  plotBoundsVerified: boolean;
  evidence: LiquidityEvidence[];
};

export type LiquidityZone = {
  side: LiquiditySide;
  y: number;
  evidenceKinds: LiquidityEvidenceKind[];
};

export type LiquidityAssessment = {
  status: LiquidityStatus;
  zones: LiquidityZone[];
  reasons: string[];
};

const inPercent = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

export function assessLiquidity(input: LiquidityInput): LiquidityAssessment {
  if (input.chartReadability !== "CLEAR") return { status: "BLOCKED", zones: [], reasons: ["CHART_NOT_CLEAR"] };
  if (!input.candlesReadable) return { status: "BLOCKED", zones: [], reasons: ["CANDLES_NOT_READABLE"] };
  if (!input.plotBoundsVerified) return { status: "BLOCKED", zones: [], reasons: ["PLOT_BOUNDS_UNVERIFIED"] };
  if (input.evidence.some((item) => !inPercent(item.x) || !inPercent(item.y))) {
    return { status: "BLOCKED", zones: [], reasons: ["INVALID_EVIDENCE_GEOMETRY"] };
  }

  const material = input.evidence.filter((item) => item.confidence !== "LOW");
  if (material.length < 2) return { status: "BLOCKED", zones: [], reasons: ["INSUFFICIENT_EVIDENCE"] };

  const zones: LiquidityZone[] = [];
  for (const side of ["buy-side", "sell-side"] as const) {
    const sideEvidence = material
      .filter((item) => item.side === side)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.kind.localeCompare(b.kind));
    if (sideEvidence.length < 2) continue;

    const groups: LiquidityEvidence[][] = [];
    for (const item of sideEvidence) {
      const group = groups.find((candidate) => Math.abs(candidate[0].y - item.y) <= 3);
      if (group) group.push(item);
      else groups.push([item]);
    }

    for (const group of groups) {
      const distinctX = Math.max(...group.map((item) => item.x)) - Math.min(...group.map((item) => item.x));
      const kinds = [...new Set(group.map((item) => item.kind))].sort();
      if (group.length >= 2 && distinctX >= 5 && kinds.length >= 1) {
        zones.push({
          side,
          y: Math.round((group.reduce((sum, item) => sum + item.y, 0) / group.length) * 10) / 10,
          evidenceKinds: kinds,
        });
      }
    }
  }

  if (zones.length === 0) return { status: "BLOCKED", zones: [], reasons: ["NO_DEFENSIBLE_ZONE"] };

  const duplicateSide = zones.some((zone, index) => zones.some((other, otherIndex) =>
    index !== otherIndex && zone.side === other.side && Math.abs(zone.y - other.y) <= 6,
  ));
  if (duplicateSide) return { status: "AMBIGUOUS", zones: [], reasons: ["OVERLAPPING_CANDIDATE_ZONES"] };

  return { status: "VERIFIED", zones, reasons: ["SCREENSHOT_EVIDENCE_ONLY"] };
}
