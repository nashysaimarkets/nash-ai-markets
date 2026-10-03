import type { Analysis } from './analysis-types';

/** A completed extraction is not a completed decision report. */
export type IndependentScannerAnalysis = Pick<Analysis, 'instrument' | 'timeframe' | 'currentPrice' | 'evidenceQuality' | 'patterns' | 'plotBounds' | 'priceScaleAnchors' | 'liquidityShield'> & {
  trustGate: { identityLocked: boolean };
};

export class ScannerOnlyError extends Error {
  constructor(message: string, public readonly scanner: IndependentScannerAnalysis, public readonly sourceImage: string) {
    super(message); this.name = 'ScannerOnlyError';
  }
}
