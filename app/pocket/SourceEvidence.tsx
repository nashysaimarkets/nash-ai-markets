"use client";
import { trackGrowth } from "./growth-client";
import { useState } from "react";
import type { Analysis, Level } from "./analysis-types";
import { resolveLevelEvidence } from "./source-evidence";

export default function SourceEvidence({ level, analysis, image, contextImage }: { level: Level; analysis: Analysis; image: string; contextImage?: string | null }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const evidence = resolveLevelEvidence(level, analysis, image, contextImage);
  return <div className="pbEvidence">
    <button type="button" aria-expanded={open} onClick={() => { if (!open) trackGrowth("evidence_opened"); setOpen(!open); }}>{open ? "Close source chart" : "Show evidence on chart"}<span aria-hidden="true">{open ? " −" : " ↗"}</span></button>
    {open ? <div className="pbEvidenceReveal">
      <header><strong>{evidence.label}</strong><span>{level.price}</span></header>
      {evidence.image ? <>
        <div className="pbEvidenceImage"><img src={evidence.image} alt={`${evidence.label} for ${level.kind} at ${level.price}`} />
          {evidence.line && highlight ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Reported level location"><line x1={evidence.line.x} y1={evidence.line.y} x2={evidence.line.x2} y2={evidence.line.y2} vectorEffect="non-scaling-stroke" /></svg> : null}
        </div>
        {evidence.line ? <label className="pbToggle"><input type="checkbox" checked={highlight} onChange={(event) => setHighlight(event.target.checked)} />Show reported location</label> : <p>Exact location is unavailable for this source. The full chart is shown without a marker.</p>}
        <small>Original screenshot · check the marked evidence against the chart.</small>
      </> : <p>This source screenshot is no longer available. Upload it again to inspect this level.</p>}
    </div> : null}
  </div>;
}
