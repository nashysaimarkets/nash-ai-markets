"use client";

import { useId, useState } from 'react';
import type { Analysis } from './analysis-types';
import { scannerDistance, scannerPercent } from './level-scanner-model';
import { sourceChartLevels } from './source-chart-levels';
import { numericLevelPrice } from './level-verification';

type Scenario = 'bull' | 'wait' | 'bear';
export type ScannerProps = { analysis: Analysis; expanded?: boolean; scenario?: Scenario | null; onScenario?: (scenario: Scenario) => void; hasContext?: boolean; sourceImage?: string; contextImage?: string | null; sourceAnalysis?: Analysis };

export default function InteractiveLevelScanner({ analysis, sourceAnalysis, sourceImage, expanded=false, scenario, onScenario }: ScannerProps) {
  // The combined report may contain levels from other uploads. Only this
  // screenshot's own report can supply geometry for its overlay.
  const frame=sourceAnalysis ?? analysis;
  const [loaded,setLoaded]=useState<{image:string;width:number;height:number}|null>(null);
  const [visible,setVisible]=useState(true);
  const [selection,setSelection]=useState('');
  const [localScenario,setLocalScenario]=useState<Scenario>('wait');
  const detailId=useId();
  const dimensions=loaded?.image===sourceImage ? loaded : null;
  const overlay=sourceChartLevels(frame,dimensions?.width ?? 0,dimensions?.height ?? 0);
  const selected=overlay.levels.find(level=>level.id===selection) ?? overlay.levels[0];
  const current=numericLevelPrice(frame.currentPrice);
  const distance=selected && current!==null ? Math.abs(selected.value-current) : null;
  const activeScenario=scenario ?? localScenario;
  const conditions=activeScenario==='bull' ? frame.bullConfirmation || frame.nextSequence.confirmation : activeScenario==='bear' ? frame.bearConfirmation || frame.nextSequence.failure : frame.nextSequence.patience || frame.noTradeCondition;
  return <section className={`psSourceScanner${expanded?' psSourceScannerExpanded':''}`} aria-label="Bullseye source chart levels">
    <header className="psSourceScannerHeader"><div><span>CHART LEVELS</span><h3>{frame.instrument} <b>{frame.timeframe}</b></h3></div><button type="button" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide levels':'Show levels'}</button></header>
    <div className="psSourceScannerStatus" role="status"><i data-ready={!overlay.reason} aria-hidden="true"/>{!sourceImage?'Original screenshot unavailable':overlay.reason ?? `${overlay.levels.length} scale-checked levels · ${overlay.anchors} axis labels`}<span>Original screenshot</span></div>
    {sourceImage ? <figure className="psSourceScannerFigure" style={dimensions ? { width: `min(100%, calc(${expanded ? 78 : 60}vh * ${dimensions.width / dimensions.height}), calc(720px * ${dimensions.width / dimensions.height}))` } : undefined}>
      <img src={sourceImage} alt={`${frame.instrument} ${frame.timeframe} original uploaded chart`} onLoad={event=>{const image=event.currentTarget;setLoaded({image:sourceImage,width:image.naturalWidth,height:image.naturalHeight});}} onError={()=>setLoaded(null)}/>
      {visible && !overlay.reason ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Price-scale calibrated levels">{overlay.levels.map(level=><g key={level.id} data-kind={level.kind} data-selected={selected?.id===level.id}><line x1={level.x} x2={level.x2} y1={level.y} y2={level.y} vectorEffect="non-scaling-stroke"/><circle cx={level.x} cy={level.y} r=".45"/></g>)}</svg> : null}
      {visible && selected && !overlay.reason ? <span className="psSourceScannerPrice" data-kind={selected.kind} style={{top:`${selected.y}%`,right:`${100-selected.x2}%`}}>{selected.price}</span> : null}
    </figure> : <p className="psSourceScannerHold">Open the original upload to inspect its levels. No replacement chart is generated.</p>}
    {overlay.reason ? <p className="psSourceScannerHold">Levels withheld until placement checks pass. The original chart stays visible.</p> : <>
      <div className="psSourceScannerLevels" role="group" aria-label="Inspect chart levels">{overlay.levels.map(level=><button type="button" key={level.id} data-kind={level.kind} aria-pressed={selected?.id===level.id} aria-controls={detailId} onClick={()=>setSelection(level.id)}><span>{level.kind==='pivot'?'Swing reference':level.kind}</span><strong>{level.price}</strong></button>)}</div>
      {selected ? <div id={detailId} className="psSourceScannerDetail" aria-live="polite"><div><strong>{selected.label}</strong><span>{distance!==null ? `${scannerDistance(distance,8)} from chart price · ${scannerPercent(distance,current!)} ${selected.value>=current!?'above':'below'}`:'Chart price not available'}</span></div><p>{frame.timeframe} source only · Position checked against the price scale. Confirm the level on your original platform.</p></div> : null}
    </>}
    <nav className="psSourceScannerScenarios" aria-label="Explore chart scenarios">{([['bull','Price rises'],['wait','Why wait?'],['bear','Price falls']] as const).map(([kind,label])=><button key={kind} type="button" aria-pressed={activeScenario===kind} onClick={()=>{setLocalScenario(kind);onScenario?.(kind);}}>{label}</button>)}</nav>
    <p className="psSourceScannerCondition" aria-live="polite">{conditions}</p>
    <footer>Screenshot snapshot · not a live feed. Conditions to check · not a price forecast.</footer>
  </section>;
}
