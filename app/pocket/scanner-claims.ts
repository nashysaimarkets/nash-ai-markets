import { currentSourceMeasurement, sourceLevelPlacement, type OriginalChartMeasurement } from './source-placement.ts';
import type { OriginalGeometryReport } from './original-pixel-geometry.ts';

export const UNVERIFIED_SCANNER_NOTICE = 'UNVERIFIED MODEL ANALYSIS — prices, patterns, liquidity and trading conclusions are suggestions until independently checked. A checked price position does not verify a candle extreme, trading role or hidden orders.';
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown) => typeof v === 'string' && v.length <= 12000;
const texts = (v: unknown) => Array.isArray(v) && v.length <= 100 && v.every(text);
const oneOf = (value:unknown, allowed:readonly string[]) => typeof value === 'string' && allowed.includes(value);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown) => record(v) && finite(v.x) && finite(v.y) && Number(v.x) >= 0 && Number(v.x) <= 100 && Number(v.y) >= 0 && Number(v.y) <= 100;
const levels = (v: unknown) => Array.isArray(v) && v.length<=32 && v.every(l=>point(l) && record(l) && point({x:l.x2,y:l.y2}) && text(l.price) && text(l.label) && oneOf(l.kind, ['support','resistance','trend','pivot','zone','gap']));
const anchors = (v: unknown) => v===undefined || Array.isArray(v) && v.length<=8 && v.every(a=>record(a) && finite(a.price) && finite(a.y));
const bounds = (v: unknown) => v==null || record(v) && ['left','top','right','bottom'].every(k=>finite(v[k]));

/** Validate transport/cache shape before any renderer reads it. Never fill missing
 * model fields with fabricated evidence or coerce malformed numeric strings. */
export function assertDisplayableScannerReport(value: unknown): void {
  const fail = () => { throw new Error('Scanner result HOLD: incomplete or malformed report. No result was accepted.'); };
  if (!record(value)) return fail();
  if (value.status !== undefined && value.status !== 'completed') return fail();
  const strings = ['instrument','ticker','timeframe','summary','verdictHeadline','traderTrap','bullishCase','bearishCase','invalidation','marketStructure','levelStory','momentum','bullConfirmation','bearConfirmation','noTradeCondition'];
  const arrays = ['observableFacts','contradictions','missingInputs','whatYouMayBeMissing','improvesSetup','killsSetup','riskFlags','indicators','checklist','relevantEventTypes'];
  if (!strings.every(k => text(value[k])) || !arrays.every(k => texts(value[k]))) return fail();
  if (!oneOf(value.direction, ['BULLISH','BEARISH','NEUTRAL']) || !oneOf(value.confidence, ['LOW','MEDIUM','HIGH']) || !oneOf(value.verdict, ['WATCH','WAIT','STAND_ASIDE','REVIEW_REQUIRED'])) return fail();
  const quality=value.evidenceQuality, score=value.setupScore, sequence=value.nextSequence, htf=value.higherTimeframe;
  if (!record(quality) || !oneOf(quality.chartReadability, ['CLEAR','PARTIAL','POOR']) || typeof quality.candlesReadable!=='boolean' || typeof quality.scaleReadable!=='boolean' || !texts(quality.limitations)) return fail();
  if (!['instrumentConfidence','timeframeConfidence'].every(k=>oneOf(quality[k], ['HIGH','MEDIUM','LOW','UNKNOWN']))) return fail();
  if (!record(score) || !['overall','structure','momentum','location','confirmation','riskClarity','eventSafety'].every(k=>finite(score[k]) && Number(score[k])>=0 && Number(score[k])<=100) || !oneOf(score.grade, ['A','B','C','D','F'])) return fail();
  if (!record(sequence) || !['now','confirmation','failure','patience','reassess'].every(k=>text(sequence[k]))) return fail();
  if (!record(htf) || typeof htf.provided!=='boolean' || !['timeframe','direction','alignment','summary'].every(k=>text(htf[k]))) return fail();
  if (!levels(value.levels)) return fail();
  if (!Array.isArray(value.patterns) || value.patterns.length>4 || !value.patterns.every(p=>record(p) && ['name','evidence','invalidation'].every(k=>text(p[k])) && oneOf(p.status, ['FORMING','CONFIRMED','FAILED','AMBIGUOUS','EXTENDED']) && (p.timeframe===undefined || text(p.timeframe)) && (p.sourceRole===undefined || text(p.sourceRole)) && (p.confidence===undefined || oneOf(p.confidence, ['HIGH','MEDIUM','LOW'])) && (p.confirmation===undefined || text(p.confirmation)) && (p.geometry===undefined || record(p.geometry) && Array.isArray(p.geometry.points) && p.geometry.points.length<=10 && p.geometry.points.every(point) && ['labelX','labelY'].every(k=>p.geometry && record(p.geometry) && (p.geometry[k]===undefined || finite(p.geometry[k])))))) return fail();
  if (!Array.isArray(value.fibLevels) || !value.fibLevels.every(f=>record(f) && text(f.ratio) && text(f.price) && finite(f.y))) return fail();
  if (value.liquidity!==undefined) {
    const l=value.liquidity;
    if (!record(l) || !oneOf(l.state, ['NONE','PARTIAL','VERIFIED']) || !oneOf(l.event, ['NONE','TESTING','SWEEP','RECLAIM','REJECTION']) || !oneOf(l.confidence, ['LOW','MEDIUM','HIGH']) || !['evidence','confirmation','invalidation'].every(k=>text(l[k])) || !Array.isArray(l.zones) || l.zones.length>4 || !l.zones.every(z=>point(z) && record(z) && finite(z.x2) && text(z.price) && text(z.basis) && oneOf(z.side, ['BUY_SIDE','SELL_SIDE']))) return fail();
    if (l.observations!==undefined && (!Array.isArray(l.observations) || l.observations.length>12 || !l.observations.every(o=>point(o) && record(o) && text(o.kind) && text(o.side) && text(o.confidence)))) return fail();
  }
  if (value.currentPrice!==undefined && !text(value.currentPrice)) return fail();
  if (!anchors(value.priceScaleAnchors) || !bounds(value.plotBounds)) return fail();
  if (value.contextBattlefield!=null && (!record(value.contextBattlefield) || !levels(value.contextBattlefield.levels) || !anchors(value.contextBattlefield.priceScaleAnchors) || !bounds(value.contextBattlefield.plotBounds) || value.contextBattlefield.currentPrice!==undefined && !text(value.contextBattlefield.currentPrice))) return fail();
  if (value.contextContribution!==undefined && (!record(value.contextContribution) || !texts(value.contextContribution.resolvedInputs) || !text(value.contextContribution.summary))) return fail();
}

export function prepareScannerReport<T>(value: T): T {
  assertDisplayableScannerReport(value);
  const report=value as Record<string,unknown>;
  const liquidity=report.liquidity as Record<string,unknown> | undefined;
  const contradictorySides=Array.isArray(liquidity?.observations) && liquidity.observations.some(o=>record(o) &&
    ((o.kind==='equal-highs' && o.side!=='buy-side') || (o.kind==='equal-lows' && o.side!=='sell-side')));
  const mark=(items:Record<string,unknown>[])=>items.map(level=>({...level,label:`Reported ${String(level.kind)} candidate`,provenance:'UNVERIFIED',placement:undefined}));
  const context=report.contextBattlefield as Record<string,unknown>|null|undefined;
  return { ...report, ...(context?{contextBattlefield:{...context,levels:mark(context.levels as Record<string,unknown>[])}}:{}), ...(contradictorySides ? {liquidity:{...liquidity,state:'PARTIAL',event:'NONE',confidence:'LOW',zones:[],evidence:'HOLD: inconsistent liquidity-side labels. No pool or event is verified.'}} : {}), levels: (report.levels as Record<string,unknown>[]).map(level=>({ ...level,
    label: `Reported ${String(level.kind)} candidate`, provenance:'UNVERIFIED', placement:undefined,
  })) } as T;
}

export function prepareLevelLabReport<T>(value:T):T {
  if (!record(value) || !['instrument','timeframe','currentPrice','levelStory','limitation'].every(k=>text(value[k])) ||
      !oneOf(value.confidence, ['HIGH','MEDIUM','LOW']) || !levels(value.levels) || !anchors(value.priceScaleAnchors) || !bounds(value.plotBounds) ||
      !record(value.evidenceQuality) || typeof value.evidenceQuality.scaleReadable!=='boolean' || typeof value.evidenceQuality.candlesReadable!=='boolean' ||
      (value.status!==undefined && value.status!=='completed')) throw new Error('Level Lab HOLD: incomplete or malformed result.');
  return {...value,levels:(value.levels as Record<string,unknown>[]).map(l=>({...l,label:`Reported ${String(l.kind)} candidate`,provenance:'UNVERIFIED',placement:undefined}))} as T;
}

export function completedLevelLabResponse(response:{status?:unknown;output_text?:unknown}) {
  if (response.status!=='completed' || typeof response.output_text!=='string' || !response.output_text.trim()) throw new Error('Level Lab HOLD: provider output is incomplete.');
  return prepareLevelLabReport(JSON.parse(response.output_text));
}

/** Synchronous current-image binding: changing a chart revokes old proof immediately.
 * Model confidence, self-consistent anchors and stored status strings grant no proof. */
export function scannerClaimEvidence(report: OriginalGeometryReport | null | undefined, image: string | null, measurement: OriginalChartMeasurement | null, confirmed: boolean) {
  const current=currentSourceMeasurement(measurement,image,report,confirmed);
  const placed=sourceLevelPlacement(measurement,image,report,confirmed);
  return { status: current && placed.levels.length ? 'POSITION_CHECKED' as const : 'HOLD' as const,
    levels: current ? placed.levels : [], reason: placed.reason,
    interpretation: 'UNVERIFIED' as const, patterns: 'UNVERIFIED' as const, liquidity: 'UNVERIFIED' as const };
}
