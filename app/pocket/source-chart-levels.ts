import type { Analysis } from './analysis-types';
import { buildLevelScanner } from './level-scanner-model';
import type { AxisVerification } from './axis-verification';

/** Strict display gate, independent of the report's broader analysis tolerance.
 * Coordinates belong to this image only. Never clamp or extrapolate a price.
 * These checks establish internal scale consistency, not independent OCR truth.
 */
export function sourceChartLevels(analysis: Analysis, width: number, height: number, gridRows: number[] = [], axis?: AxisVerification | null) {
  const hold = (reason: string) => ({ reason, levels: [], anchors: 0 });
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return hold('Loading original chart…');
  if (axis === null) return hold('Verifying the original price labels…');
  if (axis?.status === 'held') return hold(axis.reason);
  const quality = analysis.evidenceQuality;
  if (!quality?.scaleReadable || !quality.candlesReadable || quality.chartReadability !== 'CLEAR'
    || quality.timeframeConfidence !== 'HIGH' || quality.instrumentConfidence !== 'HIGH'
    || !analysis.trustGate?.scaleLocked || !analysis.trustGate.identityLocked) return hold('Chart identity or price scale needs verification.');
  if ((quality.limitations ?? []).some(item => /\blog(?:arithmic)?\b|non.?linear|scale type.*(?:unknown|uncertain)/i.test(item))) return hold('This price scale is not supported for precise placement.');
  const reportedBounds = analysis.plotBounds;
  if(!reportedBounds || !Object.values(reportedBounds).every(Number.isFinite) || reportedBounds.right>100 || reportedBounds.left<0 || reportedBounds.top<0 || reportedBounds.bottom>100) return hold('Candle plotting area needs verification.');
  const axisRight=axis?.status==='verified' && Number.isFinite(axis.axisLeft) ? axis.axisLeft!/width*100-1 : 100;
  const bounds = reportedBounds ? {...reportedBounds,right:Math.min(reportedBounds.right,axisRight)} : null;
  if (!bounds || !Object.values(bounds).every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 || bounds.right > 100 || bounds.bottom > 100 || bounds.left >= bounds.right || bounds.top >= bounds.bottom) return hold('Candle plotting area needs verification.');
  const anchors = axis?.status === 'verified' ? axis.anchors : analysis.priceScaleAnchors ?? [];
  if (axis?.status === 'verified' && new Set((analysis.priceScaleAnchors ?? []).filter(a=>anchors.some(b=>Math.abs(a.price-b.price)<=Math.max(1e-10,Math.abs(b.price)*1e-10))).map(a=>a.price)).size<3) return hold('The vision scan and independent price reader disagree.');
  if (anchors.length < 3 || anchors.some(a => !Number.isFinite(a.price) || a.price <= 0 || !Number.isFinite(a.y) || a.y < bounds.top || a.y > bounds.bottom)) return hold('At least three clear price-axis labels are needed.');
  const ordered = [...anchors].sort((a,b)=>a.price-b.price);
  if (ordered.some((a,i)=>i>0 && (a.price <= ordered[i-1].price || a.y >= ordered[i-1].y))) return hold('Price-axis labels disagree.');
  const low=ordered[0], high=ordered.at(-1)!;
  if (low.y-high.y < 20) return hold('Price-axis labels are too close together to verify placement.');
  // Fit all ticks so ordinary raster rounding at the endpoints does not bias
  // every line. Residuals still must satisfy the original-image pixel limit.
  const meanPrice=ordered.reduce((sum,a)=>sum+a.price,0)/ordered.length;
  const meanY=ordered.reduce((sum,a)=>sum+a.y,0)/ordered.length;
  const variance=ordered.reduce((sum,a)=>sum+(a.price-meanPrice)**2,0);
  const slope=ordered.reduce((sum,a)=>sum+(a.price-meanPrice)*(a.y-meanY),0)/variance;
  if (!Number.isFinite(slope) || slope>=0) return hold('Price-axis calibration is inconsistent.');
  const project=(price:number)=>meanY+(price-meanPrice)*slope;
  const pixelError=(a:number,b:number)=>Math.abs(a-b)*height/100;
  if (gridRows.length<3 || gridRows.some(y=>!Number.isFinite(y))) return hold('Screenshot grid rows could not be verified.');
  // A self-consistent model scale may still be shifted or stretched. Each
  // reported axis tick must align with a separately measured raster row.
  const matches=ordered.map(a=>gridRows.reduce((best,y)=>pixelError(a.y,y)<pixelError(a.y,best)?y:best,gridRows[0]));
  if(new Set(matches).size!==ordered.length || ordered.some((a,i)=>pixelError(a.y,matches[i])>2)) return hold('Reported price ticks do not align with the original screenshot.');
  if (ordered.some(a=>pixelError(project(a.price),a.y)>1.5)) return hold('Price-axis calibration is inconsistent.');
  const levels=buildLevelScanner(analysis).levels.flatMap(level=>{
    if ((level.source ?? 'PRIMARY') !== 'PRIMARY' || !['support','resistance','pivot'].includes(level.kind)) return [];
    const y=project(level.value);
    if (level.value<low.price || level.value>high.price || y<bounds.top || y>bounds.bottom
      || ![level.x,level.x2,level.y,level.y2].every(Number.isFinite)
      || level.x<reportedBounds!.left || level.x2>reportedBounds!.right || level.x2<=level.x
      || (!axis && (pixelError(level.y,y)>2 || pixelError(level.y2,y)>2))) return [];
    return [{...level,x:bounds.left,x2:bounds.right,y,y2:y}];
  });
  return { reason: levels.length ? null : 'No source-matched levels passed the placement checks.', levels, anchors: ordered.length };
}
