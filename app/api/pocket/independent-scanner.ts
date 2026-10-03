import type { IndependentScannerAnalysis } from '../../pocket/independent-scanner';
import type { ChartConfirmation } from '../../pocket/chart-preflight';
import { calibratePatterns } from './analysis-calibration';
import { canonicalizePocketGeometry } from '../../lib/pocket-geometry';
import { normalizePrecisionLiquidityShield } from './liquidity-precision';
import { instrumentIdentitiesMatch } from './precision-structure';

const frame = (value: string) => value.toUpperCase().replace(/MIN(?:UTE)?S?/g,'M').replace(/HOUR(?:S)?/g,'H').replace(/[^A-Z0-9]/g,'');

/** Called only with complete schema-validated precision output for this request's PRIMARY image.
 * No inferred score, verdict, narrative or metadata from a different source survives.
 */
export function completedScannerAnalysis(output: string | undefined, hint: ChartConfirmation | null): IndependentScannerAnalysis | null {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(output ?? '') as Record<string, unknown>; } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const quality = raw.evidenceQuality as IndependentScannerAnalysis['evidenceQuality'] | undefined;
  if (!quality || !['CLEAR','PARTIAL','POOR'].includes(quality.chartReadability) || typeof quality.candlesReadable !== 'boolean' || typeof quality.scaleReadable !== 'boolean' || !Array.isArray(quality.limitations) || quality.limitations.some(s => typeof s !== 'string') || !['HIGH','MEDIUM','LOW','UNKNOWN'].includes(quality.instrumentConfidence) || !['HIGH','MEDIUM','LOW','UNKNOWN'].includes(quality.timeframeConfidence)) return null;
  const instrument = typeof raw.instrumentIdentifier === 'string' ? raw.instrumentIdentifier.trim() : '';
  const timeframe = typeof raw.timeframe === 'string' ? raw.timeframe.trim() : '';
  if (!instrument || !timeframe || instrument.length > 80 || timeframe.length > 40) return null;
  const conflict = Boolean(hint && (!instrumentIdentitiesMatch(hint.instrument, instrument) || frame(hint.timeframe) !== frame(timeframe)));
  const identityLocked = !conflict && quality.instrumentConfidence === 'HIGH' && quality.timeframeConfidence === 'HIGH' && !/^(UNKNOWN|UNREADABLE)$/i.test(instrument) && !/^(UNKNOWN|UNREADABLE)$/i.test(timeframe);
  const geometry = canonicalizePocketGeometry(raw) as Record<string, unknown>;
  const bounds = geometry.plotBounds as IndependentScannerAnalysis['plotBounds'];
  if (!bounds || ![bounds.left,bounds.right,bounds.top,bounds.bottom].every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 || bounds.right > 100 || bounds.bottom > 100 || bounds.left >= bounds.right || bounds.top >= bounds.bottom) return null;
  const currentPrice = typeof raw.currentPrice === 'string' ? raw.currentPrice : '';
  return {
    instrument, timeframe, currentPrice, plotBounds: bounds,
    priceScaleAnchors: geometry.priceScaleAnchors as IndependentScannerAnalysis['priceScaleAnchors'],
    evidenceQuality: { ...quality, limitations: conflict ? [...quality.limitations, 'Independent chart identity conflicts with the selected chart.'] : quality.limitations },
    trustGate: { identityLocked },
    patterns: identityLocked ? (calibratePatterns(raw.patterns, bounds, quality.candlesReadable) as Record<string, unknown>[]).filter(p => frame(String(p.timeframe)) === frame(timeframe)) as IndependentScannerAnalysis['patterns'] : [],
    liquidityShield: normalizePrecisionLiquidityShield(geometry, currentPrice || null) as IndependentScannerAnalysis['liquidityShield'],
  };
}
