"use client";

import { useSyncExternalStore, useState } from "react";
import { ACCURACY_STORAGE_KEY, accuracySummary, benchmarkCandidates, normalizeAccuracyCorrection, readAccuracyFeedback, type AccuracyCategory, type AccuracyFeedback } from "./accuracy-feedback";

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

type AccuracyFeedbackPanelProps = { analysis: AccuracyAnalysis; onApplyCorrection: (feedback: AccuracyFeedback) => void; onReanalyse: () => void; reanalysing?: boolean };

const EMPTY_ACCURACY_FEEDBACK: AccuracyFeedback[] = [];
const accuracyFeedbackListeners = new Set<() => void>();
let cachedAccuracyFeedbackRaw: string | null | undefined;
let cachedAccuracyFeedback = EMPTY_ACCURACY_FEEDBACK;

function getAccuracyFeedbackSnapshot() {
  if (typeof window === "undefined") return EMPTY_ACCURACY_FEEDBACK;
  const raw = window.localStorage.getItem(ACCURACY_STORAGE_KEY);
  if (raw !== cachedAccuracyFeedbackRaw) {
    cachedAccuracyFeedbackRaw = raw;
    cachedAccuracyFeedback = readAccuracyFeedback(raw);
  }
  return cachedAccuracyFeedback;
}

function getAccuracyFeedbackServerSnapshot() {
  return EMPTY_ACCURACY_FEEDBACK;
}

function subscribeAccuracyFeedback(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === ACCURACY_STORAGE_KEY || event.key === null)) onStoreChange();
  };
  accuracyFeedbackListeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    accuracyFeedbackListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyAccuracyFeedback() {
  for (const listener of accuracyFeedbackListeners) listener();
}

export default function AccuracyFeedbackPanel(props: AccuracyFeedbackPanelProps) {
  const { analysis } = props;
  const fingerprint = JSON.stringify([analysis.instrument, analysis.timeframe, analysis.currentPrice, analysis.levels]);
  return <AccuracyFeedbackForAnalysis key={fingerprint} {...props} />;
}

function AccuracyFeedbackForAnalysis({ analysis, onApplyCorrection, onReanalyse, reanalysing = false }: AccuracyFeedbackPanelProps) {
  const items = useSyncExternalStore(subscribeAccuracyFeedback, getAccuracyFeedbackSnapshot, getAccuracyFeedbackServerSnapshot);
  const [mode, setMode] = useState<"IDLE" | "CORRECTING" | "SAVED">("IDLE");
  const [selected, setSelected] = useState<AccuracyCategory[]>([]);
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState("");
  const [savedEntry, setSavedEntry] = useState<AccuracyFeedback | null>(null);
  const correctionIsUnambiguous = !selected.length || normalizeAccuracyCorrection({
    verdict: "NEEDS_CORRECTION",
    categories: selected,
    correction,
    note,
  }) !== null;
  const savedCorrection = normalizeAccuracyCorrection(savedEntry);
  const savedObservationOnly = savedCorrection?.category === "CHART_READING";

  const snapshot = () => ({
    instrument: analysis.instrument,
    timeframe: analysis.timeframe,
    currentPrice: analysis.currentPrice || "UNKNOWN",
    support: analysis.levels.filter((level) => level.kind === "support").map((level) => level.price),
    resistance: analysis.levels.filter((level) => level.kind === "resistance").map((level) => level.price),
  });

  const save = (verdict: AccuracyFeedback["verdict"]) => {
    if (verdict === "NEEDS_CORRECTION" && (!selected.length || !correctionIsUnambiguous)) return;
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
    const raw = JSON.stringify(next);
    localStorage.setItem(ACCURACY_STORAGE_KEY, raw);
    localStorage.setItem("pocket-bullseye-benchmark-candidates-v1", JSON.stringify(benchmarkCandidates(next)));
    cachedAccuracyFeedbackRaw = raw; cachedAccuracyFeedback = next; notifyAccuracyFeedback();
    setSavedEntry(entry); setMode("SAVED");
    if (verdict === "NEEDS_CORRECTION") onApplyCorrection(entry);
  };

  // One correction is one fact. A shared free-text value must never be applied
  // to several categories because the first number could be misread as price.
  const toggle = (category: AccuracyCategory) => setSelected((current) => current.includes(category) ? [] : [category]);
  const summary = accuracySummary(items);

  return <section id="bullseye-feedback" className="psAccuracy" data-mode={mode}>
    <header><div><span>◎ RESULT ACCURACY CHECK</span><strong>HELP BULLSEYE FIND ITS BLIND SPOTS</strong></div><b data-review={mode === "SAVED" ? "complete" : "pending"}>{mode === "SAVED" ? (savedEntry?.verdict === "ACCURATE" ? "CONFIRMED" : "CORRECTED") : "AWAITING REVIEW"}<small>{summary.total ? `HISTORY · ${summary.rate}% FROM ${summary.total} RATED` : "RATE THIS RESULT BELOW"}</small></b></header>
    {mode === "IDLE" ? <><p>Did Pocket read this chart correctly?</p><div className="psAccuracyChoice"><button type="button" data-tone="good" onClick={() => save("ACCURATE")}>✓ ACCURATE</button><button type="button" data-tone="fix" onClick={() => setMode("CORRECTING")}>! NEEDS CORRECTION</button></div></> : null}
    {mode === "CORRECTING" ? <div className="psAccuracyForm">
      <p>What single fact did Pocket get wrong?</p>
      <div className="psAccuracyCategories">{categories.map((category) => <button key={category.value} type="button" data-active={selected.includes(category.value)} onClick={() => toggle(category.value)}>{category.label}</button>)}</div>
      <label><span>CORRECT VALUE OR LEVEL <small>{!selected.length ? "SELECT ONE" : selected[0] === "CHART_READING" ? "OPTIONAL · NOTE REQUIRED" : "REQUIRED"}</small></span><input value={correction} maxLength={80} placeholder="e.g. Support: 7640" onChange={(event) => setCorrection(event.target.value)} /></label>
      {!correctionIsUnambiguous ? <small role="alert">Use one exact numeric value for a price or level correction.</small> : null}
      <label><span>WHAT SHOULD POCKET HAVE SEEN? <small>OPTIONAL</small></span><textarea value={note} maxLength={180} placeholder="One short observation…" onChange={(event) => setNote(event.target.value)} /></label>
      <div className="psAccuracyActions"><button type="button" onClick={() => setMode("IDLE")}>CANCEL</button><button type="button" disabled={!selected.length || !correctionIsUnambiguous} onClick={() => save("NEEDS_CORRECTION")}>SAVE CORRECTION</button></div>
    </div> : null}
    {mode === "SAVED" ? <div className="psAccuracySaved"><b>✓ {savedEntry?.verdict === "NEEDS_CORRECTION" ? savedObservationOnly ? "CHART OBSERVATION SAVED" : "CORRECTION APPLIED TO DECISION MAP" : "PRIVATE FEEDBACK SAVED"}</b><p>{savedEntry?.verdict === "NEEDS_CORRECTION" ? savedObservationOnly ? "The observation is saved for a fresh chart read; no price or level was marked user verified." : "The original result is preserved and the single corrected fact is marked as user verified." : "This rating is stored privately on this device."}</p>{savedEntry?.verdict === "NEEDS_CORRECTION" ? <div><button type="button" disabled={reanalysing} onClick={onReanalyse}>{reanalysing ? "REANALYSING…" : savedObservationOnly ? "↻ REANALYSE WITH OBSERVATION" : "↻ REANALYSE USING CORRECTION"}</button><button type="button" onClick={() => setMode("IDLE")}>ADD ANOTHER</button></div> : <button type="button" onClick={() => setMode("IDLE")}>RATE AGAIN</button>}</div> : null}
    {summary.corrections ? <footer><span>{summary.corrections} CORRECTION{summary.corrections === 1 ? "" : "S"} SAVED</span><strong>REPEATED WATCH · {summary.repeatedIssue.replaceAll("_", " ")}</strong></footer> : <footer>PRIVATE · SAVED ON THIS DEVICE · SCREENSHOT NOT COPIED</footer>}
  </section>;
}
