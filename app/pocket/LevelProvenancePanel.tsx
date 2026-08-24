"use client";

import { deriveLevelProvenance, type ProvenanceLevel } from "./level-provenance";

export default function LevelProvenancePanel({ levels, anchors = [] }: { levels: ProvenanceLevel[]; anchors?: { price: number; y: number }[] }) {
  const structural = levels.filter((level) => ["support", "resistance", "pivot"].includes(level.kind));
  if (!structural.length) return null;
  return <details className="psProvenance">
    <summary><span>◉ LEVEL EVIDENCE PROVENANCE</span><small>{structural.length} LEVEL{structural.length === 1 ? "" : "S"} · TAP TO AUDIT</small><b>⌄</b></summary>
    <div>{structural.map((level, index) => {
      const item = deriveLevelProvenance(level, anchors.length);
      return <article key={`${level.kind}-${level.price}-${index}`} data-confidence={item.confidence} data-method={item.method}>
        <header><span>{item.kind.toUpperCase()}</span><strong>{item.price}</strong><b>{item.confidence}</b></header>
        <div><i>{item.method.replaceAll("_", " ")}</i><i>{item.source.replaceAll("_", " ")}</i><i>{item.precision}</i></div>
        <p>{item.evidence}</p>
        {item.precision === "APPROXIMATE" ? <small>⚠ APPROXIMATE AREA — CONFIRM ON THE BROKER PRICE SCALE</small> : null}
        <button type="button" onClick={() => document.querySelector<HTMLDetailsElement>(".psSourceEvidence")?.setAttribute("open", "")}>VIEW SUPPORTING CHART AREA</button>
      </article>;
    })}</div>
  </details>;
}
