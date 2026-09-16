"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Analysis } from "./analysis-types";
import { levelEvidenceSourceLabel } from "./pocket-derived-evidence";
import { buildLevelScanner, scannerDistance, scannerPercent, scannerView } from "./level-scanner-model";
import SourceEvidence from "./SourceEvidence";

type Scenario = "bull" | "wait" | "bear";
export type ScannerProps = { analysis: Analysis; expanded?: boolean; scenario?: Scenario | null; onScenario?: (scenario: Scenario) => void; hasContext?: boolean; sourceImage?: string; contextImage?: string | null; sourceAnalysis?: Analysis };

export default function InteractiveLevelScanner({ analysis, expanded = false, scenario = null, onScenario, hasContext = false, sourceImage, contextImage, sourceAnalysis }: ScannerProps) {
  const model = buildLevelScanner(analysis);
  const { current, support, resistance, twoSided } = model;
  const [selection, setSelection] = useState<string>("current");
  const [all, setAll] = useState(false);
  const [localScenario, setLocalScenario] = useState<Scenario>("wait");
  const root = useRef<HTMLElement>(null);
  const detailId = useId();
  const scenarioId = useId();
  const selected = model.levels.find((level) => level.id === selection) ?? null;
  const activeScenario = scenario ?? localScenario;
  const view = scannerView(model, all);
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => { element.dataset.visible = String(entry.isIntersecting); }, { rootMargin: "60px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (current === null || !model.hasStructure || !view) {
    return <section className={`psDecisionMapHold${expanded ? " psDecisionMapHoldExpanded" : ""}`} aria-label="Bullseye Decision Map precision hold">
      <span>◎ PRECISION HOLD</span>
      <strong>{hasContext ? "NO VERIFIED TWO-SIDED LEVELS" : "EXACT LEVELS NOT VERIFIED"}</strong>
      <p>{hasContext
        ? "Bullseye checked both charts but could not verify support below and resistance above the current price. The map is withheld rather than guessed."
        : "Bullseye could not verify both support below and resistance above the current price from this chart. The map is withheld rather than guessed."}</p>
      {hasContext ? <nav aria-label="Precision hold actions">
        <a href="#bullseye-source-charts">VIEW BOTH SOURCE CHARTS</a>
        <button type="button" onClick={() => document.getElementById("psResultSupportInput")?.click()}>＋ ADD CLEARER CHART</button>
      </nav> : <button type="button" onClick={() => document.getElementById("psResultSupportInput")?.click()}>＋ ADD ONE CLEARER PRICE-SCALE CHART</button>}
      <small>NO ESTIMATED LEVELS · NO HIDDEN MAP</small>
    </section>;
  }

  const distance = selected ? Math.abs(selected.value - current) : 0;
  const distanceLabel = scannerDistance(distance, model.decimals);
  const directionLabel = analysis.direction === "BULLISH" ? "Bullish" : analysis.direction === "BEARISH" ? "Bearish" : "Neutral";
  const title = selected ? selected.kind === "pivot" ? "Swing reference" : selected.kind === "support" ? "Support" : "Resistance" : "Chart price";
  const sourceLabel = selected ? levelEvidenceSourceLabel(selected.source).toLowerCase() : "Selected screenshot";
  const scenarioCopy = activeScenario === "bull"
    ? { title: "If price rises", condition: analysis.bullConfirmation || analysis.nextSequence.confirmation, check: analysis.invalidation }
    : activeScenario === "bear"
      ? { title: "If price falls", condition: analysis.bearConfirmation || analysis.nextSequence.failure, check: analysis.invalidation }
      : { title: "Why wait?", condition: analysis.nextSequence.patience || analysis.noTradeCondition, check: analysis.nextSequence.reassess };
  function changeView(next: boolean) {
    setAll(next);
    if (!next && selected && selected.id !== support?.id && selected.id !== resistance?.id) setSelection("current");
  }

  return <section ref={root} className={`psLevelScanner${expanded ? " psLevelScannerExpanded" : ""}`} data-visible="true" data-structure={twoSided ? "two-sided" : "partial"} data-scenario={activeScenario} aria-label="Bullseye Decision Map">
    <div className="psScannerTopline"><span>Level scanner <b>{analysis.timeframe}</b></span><small>{twoSided ? "Two-sided structure" : "Partial structure"}</small></div>
    <div className="psScannerToolbar">
      <p>Tap a level to explore</p>
      <div className="psScannerScope" role="group" aria-label="Price range shown">
        <button type="button" aria-pressed={!all} onClick={() => changeView(false)}>Nearby</button>
        <button type="button" aria-pressed={all} onClick={() => changeView(true)}>All {model.levels.length}</button>
      </div>
    </div>
    {!twoSided ? <p className="psScannerPartial">{support ? "Resistance not verified" : "Support not verified"} · only available evidence is shown.</p> : null}

    <div className="psScannerStage" style={{ "--scanner-height": `${view.height}px`, "--scanner-count": view.entries.length } as CSSProperties}>
      <div className="psScannerDepth" aria-hidden="true"><i/><i/><i/></div>
      <div className="psScannerOrbit" aria-hidden="true"><i/><i/><i/></div>
      <div className="psScannerSweep" aria-hidden="true"/>
      <svg className="psScannerGeometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {view.ticks.map((tick, index) => <path key={index} className="psScannerGridline" d={`M 3 ${tick.y} H 96`} />)}
        <path className="psScannerSpine" d="M 25 5 V 95"/>
        {view.entries.map((entry) => <g key={entry.id} data-kind={entry.kind} data-selected={selection === entry.id}>
          <path className="psScannerPriceBeam" d={`M 4 ${entry.y} H 33`}/>
          <path className="psScannerLeader" d={`M 25 ${entry.y} H 33 L 45 ${entry.labelY} H 49`}/>
        </g>)}
      </svg>
      <div className="psScannerAnchors" aria-hidden="true">{view.entries.map((entry) => <i key={entry.id} data-kind={entry.kind} data-selected={selection === entry.id} style={{ top: `${entry.y}%` }} />)}</div>
      <div className="psScannerLabels">{view.entries.map((entry) => <button type="button" key={entry.id} className="psScannerLevel" data-kind={entry.kind} aria-pressed={selection === entry.id} aria-controls={detailId} onClick={() => setSelection(entry.id)} style={{ top: `${entry.labelY}%` }} aria-label={`${entry.kind === "current" ? "Chart price" : entry.kind === "pivot" ? "Swing reference" : entry.kind} ${entry.price}${entry.level ? `, ${levelEvidenceSourceLabel(entry.level.source).toLowerCase()}` : ""}`}>
        <span>{entry.kind === "current" ? "Chart price" : entry.kind === "pivot" ? "Swing reference" : entry.kind === "support" ? "Support" : "Resistance"}<i aria-hidden="true">{selection === entry.id ? "●" : "+"}</i></span>
        <strong>{entry.price}</strong>
        <small>{entry.kind === "current" ? "Screenshot snapshot" : `${scannerDistance(Math.abs(entry.value - current), model.decimals)} ${entry.value >= current ? "above" : "below"}`}</small>
      </button>)}</div>
      <div className="psScannerScaleNote">Linear price scale <span>·</span> {all ? "All verified levels" : "Nearest boundaries"}</div>
    </div>

    <div className="psScannerInspector" id={detailId} aria-live="polite" aria-atomic="true" data-kind={selected?.kind ?? "current"}>
      <div key={selection} className="psScannerDetailReveal">
        <div className="psScannerDetailHeading"><div><span>{title}</span><strong>{selected?.price ?? model.currentLabel}</strong></div><b>{selected ? `${scannerPercent(distance, current)} ${selected.value >= current ? "above" : "below"}` : `${directionLabel} read`}</b></div>
        <p>{selected ? selected.label : "Select a support, resistance or swing reference to inspect its source and distance."}</p>
        <footer><span>{sourceLabel}</span>{selected ? <span>{distanceLabel} from chart price</span> : <span>Snapshot · not a live feed</span>}</footer>
        {selected && sourceImage ? <SourceEvidence key={selected.id} level={selected} analysis={sourceAnalysis ?? analysis} image={sourceImage} contextImage={contextImage} /> : null}
      </div>
    </div>

    <nav className="psScannerScenarios" aria-label="Explore Decision Map scenarios">{([
      { kind: "bull", icon: "↗", label: "Price rises" }, { kind: "wait", icon: "◈", label: "Why wait?" }, { kind: "bear", icon: "↘", label: "Price falls" },
    ] as const).map((item) => <button type="button" key={item.kind} data-kind={item.kind} aria-pressed={activeScenario === item.kind} aria-controls={scenarioId} onClick={() => { setLocalScenario(item.kind); onScenario?.(item.kind); }}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav>
    <div className="psScannerScenarioDetail" id={scenarioId} data-kind={activeScenario} aria-live="polite" aria-atomic="true"><div key={activeScenario} className="psScannerDetailReveal"><span>{scenarioCopy.title}</span><p>{scenarioCopy.condition}</p><details><summary>{activeScenario === "wait" ? "When to reassess" : "What challenges this scenario"}</summary><p>{scenarioCopy.check}</p></details><small>Conditions to check · not a price forecast</small></div></div>
  </section>;
}
