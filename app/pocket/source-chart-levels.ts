import type { Analysis } from './analysis-types';
import { buildLevelScanner } from './level-scanner-model';

/** Strict display gate, independent of the report's broader analysis tolerance.
 * Coordinates belong to this image only. Never clamp or extrapolate a price.
 * These checks establish internal scale consistency, not independent OCR truth.
 */
export function sourceChartLevels(analysis: Analysis, width: number, height: number) {
  const hold = (reason: string) => ({ reason, levels: [], anchors: 0 });
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return hold('Loading original chart…');
  const quality = analysis.evidenceQuality;
  if (!quality?.scaleReadable || !quality.candlesReadable || quality.chartReadability !== 'CLEAR'
    || quality.timeframeConfidence !== 'HIGH' || quality.instrumentConfidence !== 'HIGH'
    || !analysis.trustGate?.scaleLocked || !analysis.trustGate.identityLocked) return hold('Chart identity or price scale needs verification.');
  if (quality.limitations.some(item => /\blog(?:arithmic)?\b|non.?linear|scale type.*(?:unknown|uncertain)/i.test(item))) return hold('This price scale is not supported for precise placement.');
  const bounds = analysis.plotBounds;
  if (!bounds || !Object.values(bounds).every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 || bounds.right > 100 || bounds.bottom > 100 || bounds.left >= bounds.right || bounds.top >= bounds.bottom) return hold('Candle plotting area needs verification.');
  const anchors = analysis.priceScaleAnchors ?? [];
  if (anchors.length < 3 || anchors.some(a => !Number.isFinite(a.price) || a.price <= 0 || !Number.isFinite(a.y) || a.y < bounds.top || a.y > bounds.bottom)) return hold('At least three clear price-axis labels are needed.');
  const ordered = [...anchors].sort((a,b)=>a.price-b.price);
  if (ordered.some((a,i)=>i>0 && (a.price <= ordered[i-1].price || a.y >= ordered[i-1].y))) return hold('Price-axis labels disagree.');
  const low=ordered[0], high=ordered.at(-1)!;
  if (low.y-high.y < 20) return hold('Price-axis labels are too close together to verify placement.');
  const project=(price:number)=>low.y+(price-low.price)/(high.price-low.price)*(high.y-low.y);
  const pixelError=(a:number,b:number)=>Math.abs(a-b)*height/100;
  if (ordered.some(a=>pixelError(project(a.price),a.y)>1.5)) return hold('Price-axis calibration is inconsistent.');
  const levels=buildLevelScanner(analysis).levels.flatMap(level=>{
    if ((level.source ?? 'PRIMARY') !== 'PRIMARY' || !['support','resistance','pivot'].includes(level.kind)) return [];
    const y=project(level.value);
    if (level.value<low.price || level.value>high.price || y<bounds.top || y>bounds.bottom
      || ![level.x,level.x2,level.y,level.y2].every(Number.isFinite)
      || level.x<bounds.left || level.x2>bounds.right || level.x2<=level.x
      || pixelError(level.y,y)>2 || pixelError(level.y2,y)>2) return [];
    return [{...level,x:bounds.left,x2:bounds.right,y,y2:y}];
  });
  return { reason: levels.length ? null : 'No source-matched levels passed the placement checks.', levels, anchors: ordered.length };
}
