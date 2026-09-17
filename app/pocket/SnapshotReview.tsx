"use client";
import { useState } from "react";
import type { ProcessReview } from "./analysis-types";

export default function SnapshotReview({ before, after, beforeLabel = "Original read", afterLabel = "Later chart", review }: { before: string; after: string; beforeLabel?: string; afterLabel?: string; review?: ProcessReview | null }) {
  const [step, setStep] = useState(0);
  const [paired, setPaired] = useState(false);
  const steps = ["Original", "Later chart", "What changed", "Next lesson"];
  return <section className="pbSnapshot" aria-label="Explore before and after charts">
    <nav aria-label="Review steps">{steps.map((label, index) => <button key={label} type="button" aria-pressed={step === index} disabled={index > 1 && !review} onClick={() => setStep(index)}><small>0{index + 1}</small>{label}</button>)}</nav>
    <div className="pbSnapshotBody" key={`${step}-${paired}`}>
      {step < 2 ? <>
        <div className="pbSnapshotControls"><strong>{step === 0 ? beforeLabel : afterLabel}</strong><button type="button" disabled={!after} aria-pressed={paired} onClick={() => setPaired(!paired)}>{paired ? "Single chart" : "View together"}</button></div>
        <div className="pbSnapshotImages" data-paired={paired}>{paired && after ? <><figure><img src={before} alt="Original saved screenshot"/><figcaption>{beforeLabel}</figcaption></figure><figure><img src={after} alt="Later uploaded screenshot"/><figcaption>{afterLabel}</figcaption></figure></> : step === 1 && !after ? <p>The later screenshot is unavailable in this older saved review.</p> : <figure><img src={step === 0 ? before : after} alt={step === 0 ? "Original saved screenshot" : "Later uploaded screenshot"}/></figure>}</div>
        <p>Two snapshots, shown at their own proportions. No intervening candles or trades are inferred.</p>
      </> : step === 2 && review ? <div className="pbSnapshotChanges"><h3>{review.headline}</h3>{review.evidenceChanges.length ? review.evidenceChanges.map((change, index) => <article key={index} data-impact={change.impact}><b>{change.impact.toLowerCase()}</b><p><small>Before</small>{change.before}</p><p><small>After</small>{change.after}</p></article>) : <p>No reliable structural change was established.</p>}</div>
      : review ? <div className="pbSnapshotLesson"><span>Suggested by the analysis</span><h3>{review.nextRule}</h3><p>Keep what you agree with in your own notebook. Your original read stays unchanged.</p></div> : null}
    </div>
    <div className="pbSnapshotControls"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>← Previous</button><small>{step + 1} / {review ? 4 : 2}</small><button type="button" disabled={step >= (review ? 3 : 1)} onClick={() => setStep(step + 1)}>Next →</button></div>
  </section>;
}
