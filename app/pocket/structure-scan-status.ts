import type { Analysis } from './analysis-types';

/** An empty candidate list cannot establish absence on an inconclusive read.
 * A price-scale hold alone does not prevent non-price structural discussion. */
export function hasReadableStructureEvidence(analysis: Pick<Analysis, 'evidenceQuality' | 'trustGate'>): boolean {
  const quality = analysis.evidenceQuality;
  return analysis.trustGate?.identityLocked === true
    && quality.chartReadability === 'CLEAR'
    && quality.candlesReadable === true
    && quality.instrumentConfidence === 'HIGH'
    && quality.timeframeConfidence === 'HIGH';
}
