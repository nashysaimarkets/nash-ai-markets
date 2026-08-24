"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCURACY_STORAGE_KEY, accuracySummary, benchmarkCandidates, readAccuracyFeedback, type AccuracyCategory, type AccuracyFeedback } from "./accuracy-feedback";

type AccuracyAnalysis = {
  instrument: string;
  timeframe: string;
  currentPrice?: string;
  levels: { kind: string; price: string }[];
};

const categories: { value: AccuracyCategory; label: string }[] = [
  { value: "INSTRUMENT", label: "Instrument" },
  { value: "TIMEFRAME", label: "Timeframe" },
  { value: "CURRENT_PRICE", label: "Current price" },
  { value: "SUPPORT", label: "Support" },
  { value: "RESISTANCE", label: "Resistance" },
  { value: "CHART_READING", label: "Chart reading" },
];

export default function AccuracyFeedbackPanel({ analysis, onApplyCorrection, onReanalyse, reanalysing = false }: { analysis: AccuracyAnalysis; onApplyCorrection: (feedback: AccuracyFeedback) => void; onReanalyse: () => void; reanalysing?: boolean }) {
  const fingerprint = useMemo(() => JSON.stringify([analysis.instrument, analysis.timeframe, analysis.currentPrice, analysis.levels]), [analysis]);
  const [items, setItems] = useState<AccuracyFeedback[]>([]);
  const [mode, setMode] = useState<"IDLE" | "CORRECTING" | "SAVED">("IDLE");
  const [selected, setSelected] = useState<AccuracyCategory[]>([]);
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState("");
  const [savedEntry, setSavedEntry] = useState<AccuracyFeedback | null>(null);

  useEffect(() => { setItems(readAccuracyFeedback(localStorage.getItem(ACCURACY_STORAGE_KEY))); }, []);
  useEffect(() => { setMode("IDLE"); setSelected([]); setCorrection(""); setNote(""); setSavedEntry(null); }, [fingerprint]);

  const snapshot = () => ({
    instrument: analysis.instrument,
    timeframe: analysis.timeframe,
    currentPrice: analysis.currentPrice || "UNKNOWN",
    support: analysis.levels.filter((level) => level.kind === "support").map((level) => level.price),
    resistance: analysis.levels.filter((level) => level.kind === "resistance").map((level) => level.price),
  });

  const save = (verdict: AccuracyFeedback["verdict"]) => {
    if (verdict === "NEEDS_CORRECTION" && !selected.length) return;
    const entry: AccuracyFeedback = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `accuracy-${Date.now()}`,
      createdAt: new Date().toISOString(),
      verdict,
      categories: verdict === "ACCURATE" ? [] : selected,
      correction: correction.trim().slice(0, 80),
      note: note.trim().slice(0, 180),
      snapshot: snapshot(),
    };
    const next = [entry, ...items].slice(0, 100);
    localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem("pocket-bullseye-benchmark-candidates-v1", JSON.stringify(benchmarkCandidates(next)));
    setItems(next); setSavedEntry(entry); setMode("SAVED");
    if (verdict === "NEEDS_CORRECTION") onApplyCorrection(entry);
  };

  const toggle = (category: AccuracyCategory) => setSelected((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  const summary = accuracySummary(items);

  return <section className="psAccuracy" data-mode={mode}>
    <header><div><span>◎ RESULT ACCURACY CHECK</span><strong>HELP BULLSEYE FIND ITS BLIND SPOTS</strong></div>{summary.total ? <b>{summary.rate}% <small>ACCURATE · {summary.total} RATED</small></b> : null}</header>
    {mode === "IDLE" ? <><p>Did Pocket read this chart correctly?</p><div className="psAccuracyChoice"><button type="button" data-tone="good" onClick={() => save("ACCURATE")}>✓ ACCURATE</button><button type="button" data-tone="fix" onClick={() => setMode("CORRECTING")}>! NEEDS CORRECTION</button></div></> : null}
    {mode === "CORRECTING" ? <div className="psAccuracyForm">
      <p>What did Pocket get wrong?</p>
      <div className="psAccuracyCategories">{categories.map((category) => <button key={category.value} type="button" data-active={selected.includes(category.value)} onClick={() => toggle(category.value)}>{category.label}</button>)}</div>
      <label><span>CORRECT VALUE OR LEVEL <small>OPTIONAL</small></span><input value={correction} maxLength={80} placeholder="e.g. support 7640, not 7650" onChange={(event) => setCorrection(event.target.value)} /></label>
      <label><span>WHAT SHOULD POCKET HAVE SEEN? <small>OPTIONAL</small></span><textarea value={note} maxLength={180} placeholder="One short observation…" onChange={(event) => setNote(event.target.value)} /></label>
      <div className="psAccuracyActions"><button type="button" onClick={() => setMode("IDLE")}>CANCEL</button><button type="button" disabled={!selected.length} onClick={() => save("NEEDS_CORRECTION")}>SAVE CORRECTION</button></div>
    </div> : null}
    {mode === "SAVED" ? <div className="psAccuracySaved"><b>✓ {savedEntry?.verdict === "NEEDS_CORRECTION" ? "CORRECTION APPLIED TO DECISION MAP" : "PRIVATE FEEDBACK SAVED"}</b><p>{savedEntry?.verdict === "NEEDS_CORRECTION" ? "The original result is preserved and corrected facts are now marked as user verified." : "This rating is stored privately on this device."}</p>{savedEntry?.verdict === "NEEDS_CORRECTION" ? <div><button type="button" disabled={reanalysing} onClick={onReanalyse}>{reanalysing ? "REANALYSING…" : "↻ REANALYSE USING CORRECTION"}</button><button type="button" onClick={() => setMode("IDLE")}>ADD ANOTHER</button></div> : <button type="button" onClick={() => setMode("IDLE")}>RATE AGAIN</button>}</div> : null}
    {summary.corrections ? <footer><span>{summary.corrections} CORRECTION{summary.corrections === 1 ? "" : "S"} SAVED</span><strong>REPEATED WATCH · {summary.repeatedIssue.replaceAll("_", " ")}</strong></footer> : <footer>PRIVATE · SAVED ON THIS DEVICE · SCREENSHOT NOT COPIED</footer>}
  </section>;
}
