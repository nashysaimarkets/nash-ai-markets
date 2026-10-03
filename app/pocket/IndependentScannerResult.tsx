"use client";
/* Private chart images deliberately bypass next/image. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import type { IndependentScannerAnalysis } from './independent-scanner';
import LiquidityGuardOverlay from './LiquidityGuardOverlay';
import { readCandlePixels, type CandlePixels } from './candle-pixels';
import { pixelCheckedPatterns } from './pattern-pixels';

/** Completed scanner evidence remains usable without pretending the report completed. */
export default function IndependentScannerResult({ analysis, sourceImage }: { analysis: IndependentScannerAnalysis; sourceImage: string }) {
  const [view, setView] = useState<'patterns' | 'liquidity'>('patterns');
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; pixels: CandlePixels | null } | null>(null);
  const key = JSON.stringify([sourceImage, analysis]);
  const readable = analysis.trustGate.identityLocked && analysis.evidenceQuality.chartReadability === 'CLEAR' && analysis.evidenceQuality.candlesReadable;
  useEffect(() => {
    const image = ref.current;
    if (!image?.complete || !image.naturalWidth || !analysis.plotBounds) return;
    let pixels: CandlePixels | null = null;
    if (readable) try {
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) { context.drawImage(image, 0, 0); pixels = readCandlePixels(context.getImageData(0, 0, canvas.width, canvas.height), analysis.plotBounds); }
      canvas.width = canvas.height = 1;
    } catch { /* Original remains visible; uncertain paths stay withheld. */ }
    setMeasured({ key, pixels });
    // The key contains the complete source and independently read evidence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, view]);
  const pixels = measured?.key === key ? measured.pixels : null;
  const patterns = readable ? pixelCheckedPatterns(analysis.patterns, analysis.timeframe, analysis.plotBounds, pixels) : [];
  return <section className="psIndependentScanners" aria-label="Completed scanners without a written report">
    <header className="psInstrumentHeader"><div><span>COMPLETED SCANNER FINDINGS</span><small>{analysis.instrument} · {analysis.timeframe} · Written report unavailable</small></div></header>
    <p>These chart scans completed independently. A setup grade and trade verdict are unavailable. Drawings still require checks against the supplied chart.</p>
    <nav className="psIndependentScannerViews" aria-label="Independent scanner view"><button type="button" aria-pressed={view === 'patterns'} onClick={() => setView('patterns')}>PATTERN WATCH</button><button type="button" aria-pressed={view === 'liquidity'} onClick={() => setView('liquidity')}>LIQUIDITY GUARD</button></nav>
    {view === 'liquidity' ? <LiquidityGuardOverlay analysis={analysis} sourceImage={sourceImage} /> : <section className="psChartXRay psPatternPrecise">
      <header className="psInstrumentHeader"><div><span>PATTERN WATCH</span><small>Historical chart structure</small></div><strong>{patterns.length} PIXEL-CHECKED</strong></header>
      <div className="psXRayCanvas" style={pixels ? { width: `min(100%, calc(65vh * ${pixels.width / pixels.height}), calc(760px * ${pixels.width / pixels.height}))` } : undefined}>
        <img ref={ref} src={sourceImage} alt={`${analysis.instrument} ${analysis.timeframe} source chart for independent pattern inspection`} onLoad={() => setReady(v => v + 1)} />
        {pixels && patterns.length ? <svg className="psXRayPatterns" viewBox={`0 0 ${pixels.width} ${pixels.height}`} preserveAspectRatio="none" aria-label="Pixel-checked historical pattern endpoints">{patterns.map((p, i) => <g key={i} data-status={p.status}><polyline points={p.geometry!.points.map(point => `${point.x * pixels.width / 100},${point.y * pixels.height / 100}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" /></g>)}</svg> : null}
      </div>
      {!readable ? <p role="status">Pattern drawing withheld: chart identity or candle readability needs verification.</p> : null}
      {analysis.patterns.length ? <div className="psPatternSignals">{analysis.patterns.map((p, i) => <article key={i} data-status={p.status} data-confidence={p.confidence}><header><strong>{p.name}</strong><b>{p.status} · {p.confidence} reported confidence</b></header><p>{p.evidence}</p><p><strong>Confirms if:</strong> {p.confirmation}</p><p><strong>Invalid if:</strong> {p.invalidation}</p><p>{patterns.some(checked => checked.name === p.name) ? 'Historical endpoints passed the pixel checks; interpretation remains provisional.' : 'Reported candidate; drawing has not passed the original candle-endpoint checks.'}</p></article>)}</div> : <p>No named pattern was reported in this scan. This does not establish that every possible formation is absent.</p>}
    </section>}
  </section>;
}
