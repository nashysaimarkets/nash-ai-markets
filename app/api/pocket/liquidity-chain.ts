import { assessLiquidity, type LiquidityEvidence, type LiquidityAssessment } from "../../pocket/liquidity-evidence.ts";

type RecordValue = Record<string, unknown>;
type Zone = {side: "BUY_SIDE" | "SELL_SIDE"; x: number; x2: number; y: number};
type PlotBounds = {left: number; top: number; right: number; bottom: number};
const blocked = (reason: string): LiquidityAssessment => ({status:"BLOCKED",zones:[],reasons:[reason]});

/** Structural percentage validity only; this does not verify source pixels. */
export function validPlotBounds(bounds: unknown): bounds is PlotBounds {
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) return false;
  const plot = bounds as RecordValue;
  const {left, top, right, bottom} = plot;
  return [left,top,right,bottom].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) &&
    (left as number) < (right as number) && (top as number) < (bottom as number);
}

/** Only explicit screenshot observations are evidence; line endpoints are never synthesized. */
export function assessProductionLiquidityChain(observations: unknown, quality: RecordValue, bounds: unknown, zones: Zone[]): LiquidityAssessment {
  if (!validPlotBounds(bounds)) return blocked("PLOT_BOUNDS_UNVERIFIED");
  const {left, top, right, bottom} = bounds;
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

/** A pool and an event are separate claims. Repeated highs/lows alone do not
 * demonstrate that a later sweep, reclaim or rejection has occurred. */
export function corroborateLiquidityEvent(event: string, observations: unknown, zones: Zone[]): string {
  const kind = event === "SWEEP" || event === "RECLAIM" ? "sweep-reclaim" : event === "REJECTION" ? "rejection" : null;
  if (!kind || !Array.isArray(observations)) return "NONE";
  const evidence = observations.filter((point): point is LiquidityEvidence => Boolean(point && typeof point === "object" &&
    typeof point.x === "number" && typeof point.y === "number" && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    (point.confidence === "HIGH" || point.confidence === "MEDIUM")));
  for (const zone of zones) {
    const side = zone.side === "BUY_SIDE" ? "buy-side" : "sell-side";
    const structuralKind = zone.side === "BUY_SIDE" ? "equal-highs" : "equal-lows";
    const local = evidence.filter(point => point.side === side && point.x >= zone.x && point.x <= zone.x2 && Math.abs(point.y - zone.y) <= 3);
    for (const witness of local.filter(point => point.kind === kind)) {
      const prior = local.filter(point => point.kind === structuralKind && point.x < witness.x);
      if (prior.length >= 2 && Math.max(...prior.map(point => point.x)) - Math.min(...prior.map(point => point.x)) >= 5) return event;
    }
  }
  return "NONE";
}
