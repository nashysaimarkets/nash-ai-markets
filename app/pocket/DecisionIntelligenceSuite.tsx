"use client";

import { useState } from "react";
import {
  deriveAnalysisMaps,
  type DecisionIntelligenceAnalysis,
  type MapId,
} from "./pocket-decision-intelligence";

export type { DecisionIntelligenceAnalysis } from "./pocket-decision-intelligence";

export default function DecisionIntelligenceSuite({ analysis }: { analysis: DecisionIntelligenceAnalysis }) {
  const maps = deriveAnalysisMaps(analysis);
  const [activeId, setActiveId] = useState<MapId>("liquidity");
  const active = maps.find((map) => map.id === activeId) ?? maps[0];
  return <section id="bullseye-intelligence-maps" className="psIntelligenceSuite" data-map={active.id}>
    <header><div><span>⌖ BULLSEYE ANALYSIS MAPS</span><small>10 VIEWS · ONE VERIFIED AUDIT · NO EXTRA UPLOAD</small></div><b>DATA-LIGHT</b></header>
    <nav aria-label="Choose an analysis map">{maps.map((map) => <button key={map.id} type="button" data-active={active.id === map.id} aria-pressed={active.id === map.id} onClick={() => setActiveId(map.id)}><i>{map.icon}</i><span>{map.label}</span></button>)}</nav>
    <article className="psMapConsole" aria-live="polite" data-status={active.status}>
      <header><div><small>{active.label} MAP</small><h2>{active.headline}</h2></div><b>{active.status}</b></header>
      <p>{active.summary}</p>
      {active.id === "confluence" ? <div className="psConfluenceGrid">{active.readings.map((reading) => { const score = Number.parseInt(reading.value, 10) || 0; return <section key={reading.label}><span>{reading.label}</span><i><b style={{ width: `${score * 10}%` }}/></i><strong>{reading.value}</strong></section>; })}</div> : <div className="psMapReadings">{active.readings.map((reading) => <section key={`${reading.label}-${reading.value}`} data-tone={reading.tone ?? "neutral"}><small>{reading.label}</small><strong>{reading.value}</strong></section>)}</div>}
      <footer><span>VISIBLE EVIDENCE ONLY</span><b>{active.status === "MORE INPUT NEEDED" ? "MISSING INPUTS STAY MISSING" : "CONDITIONS STAY CONDITIONAL"}</b></footer>
    </article>
  </section>;
}
