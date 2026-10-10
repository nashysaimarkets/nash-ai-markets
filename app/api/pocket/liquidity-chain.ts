import { assessLiquidity, type LiquidityEvidence, type LiquidityAssessment } from "../../pocket/liquidity-evidence.ts";

type RecordValue = Record<string, unknown>;
type Zone = {side: "BUY_SIDE" | "SELL_SIDE"; x: number; x2: number; y: number};
const blocked = (reason: string): LiquidityAssessment => ({status:"BLOCKED",zones:[],reasons:[reason]});

/** Only explicit screenshot observations are evidence; line endpoints are never synthesized. */
export function assessProductionLiquidityChain(observations: unknown, quality: RecordValue, bounds: unknown, zones: Zone[]): LiquidityAssessment {
  const plot = bounds && typeof bounds === "object" ? bounds as RecordValue : {};
  const {left, top, right, bottom} = plot;
  const validBounds = [left,top,right,bottom].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) &&
    (left as number) < (right as number) && (top as number) < (bottom as number);
  if (!validBounds) return blocked("PLOT_BOUNDS_UNVERIFIED");
  if (!Array.isArray(observations)) return blocked("INSUFFICIENT_EVIDENCE");
  if (observations.length > 12) return blocked("INVALID_EVIDENCE_CONTRACT");
  if (observations.some(point => !point || typeof point !== "object" ||
      typeof point.x !== "number" || typeof point.y !== "number" || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < (left as number) || point.x > (right as number) || point.y < (top as number) || point.y > (bottom as number))) {
    return blocked("INVALID_EVIDENCE_GEOMETRY");
  }
  const evidence = observations as LiquidityEvidence[];
  if (evidence.some(point => (point.kind === "equal-highs" && point.side !== "buy-side") ||
      (point.kind === "equal-lows" && point.side !== "sell-side"))) return blocked("INVALID_EVIDENCE_CONTRACT");
  const input = {
    chartReadability: quality.chartReadability === "CLEAR" ? "CLEAR" as const : "PARTIAL" as const,
    candlesReadable: quality.candlesReadable === true,
    plotBoundsVerified: true,
    evidence,
  };
  const assessment = assessLiquidity(input);
  if (assessment.status !== "VERIFIED") return assessment;
  // Every displayed zone needs its own chain inside its horizontal span and at its calibrated row.
  for (const zone of zones) {
    const side = zone.side === "BUY_SIDE" ? "buy-side" : "sell-side";
    const localEvidence = evidence.filter(point => point.side === side && point.x >= zone.x && point.x <= zone.x2 && Math.abs(point.y-zone.y) <= 3);
    const local = assessLiquidity({...input,evidence:localEvidence});
    if (local.status !== "VERIFIED") return blocked("ZONE_NOT_CORROBORATED");
  }
  return zones.length ? assessment : blocked("NO_DEFENSIBLE_ZONE");
}
