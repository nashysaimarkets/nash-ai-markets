"use client";
import { trackGrowth } from "./growth-client";
import { useEffect, useRef, useState } from "react";
import type { LockedDecision } from "./analysis-types";
import { createNotebookBackup, MAX_BACKUP_BYTES, notebookMatches, parseNotebookBackup } from "./notebook";

type Backup = ReturnType<typeof parseNotebookBackup>;
type Props = { decisions: LockedDecision[]; onReview: (decision: LockedDecision) => void; onSave: (decision: LockedDecision) => Promise<void>; loadRules: () => Promise<string[]>; saveRules: (rules: string[]) => Promise<void>; onRestore: (backup: Backup) => Promise<string> };
function NoteEditor({ decision, onSave }: Pick<Props, "onSave"> & { decision: LockedDecision }) {
  const [lesson, setLesson] = useState(decision.notebook?.lesson ?? "");
  const [tags, setTags] = useState(decision.notebook?.tags.join(", ") ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setStatus("");
    try { await onSave({ ...decision, notebook: { lesson: lesson.trim(), tags: [...new Set(tags.split(",").map((tag) => tag.trim().slice(0,40)).filter(Boolean))].slice(0,8), updatedAt: new Date().toISOString() } }); trackGrowth("note_saved"); setStatus("Your note is saved. The original analysis is unchanged."); }
    catch { setStatus("Your note could not be saved. Keep this page open and retry."); } finally { setBusy(false); }
  }
  return <details className="pbNoteEditor"><summary>My lesson & tags {decision.notebook?.lesson ? "· saved" : ""}</summary>
    {decision.review?.nextRule ? <p><small>AI suggestion</small>{decision.review.nextRule}</p> : null}
    <label>What did I learn?<textarea maxLength={1500} value={lesson} onChange={(event) => setLesson(event.target.value)} placeholder="My own observation or rule for next time…" /></label>
    <label>Setup tags, separated by commas<input maxLength={320} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Breakout, rushed entry, waited for confirmation" /></label>
    <button type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save my note"}</button><p role="status">{status}</p>
  </details>;
}
function NotebookInsights({ decisions }: { decisions: LockedDecision[] }) {
  const reviewed = decisions.filter((decision) => decision.review);
  const counts = new Map<string, number>();
  for (const decision of reviewed) for (const tag of new Set(decision.review!.behaviourTags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([,count]) => count >= 2).sort((a,b) => b[1]-a[1]).slice(0,3);
  return reviewed.length ? <details className="pbReviewPatterns"><summary>Patterns in my reviews · {reviewed.length} reviewed</summary><p>AI review tags across saved snapshots. These are observations to challenge, not verified facts about your trading.</p>{repeated.length ? <ul>{repeated.map(([tag,count]) => <li key={tag}>{tag} <span>· {count} reviews</span></li>)}</ul> : <p>No repeated review tag yet. Record your own lesson after each review.</p>}</details> : null;
}
export default function SetupNotebook({ decisions, onReview, onSave, loadRules, saveRules, onRestore }: Props) {
  const [query, setQuery] = useState(""); const [instrument, setInstrument] = useState(""); const [timeframe, setTimeframe] = useState(""); const [state, setState] = useState("");
  const [limit, setLimit] = useState(10); const [rules, setRules] = useState<string[]>(["", "", ""]); const [rulesReady, setRulesReady] = useState(false); const [pinned, setPinned] = useState<string[]>([]);
  const [message, setMessage] = useState(""); const [backup, setBackup] = useState<Backup | null>(null); const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { let active = true; loadRules().then((items) => { if (active) { setRules([items[0] ?? "", items[1] ?? "", items[2] ?? ""]); setPinned(items); setRulesReady(true); } }).catch(() => { if (active) setMessage("Personal rules could not be loaded. Retry when device storage is available."); }); return () => { active = false; }; }, [loadRules]);
  useEffect(() => { trackGrowth("notebook_opened", { once: "notebook" }); }, []);
  const filtered = decisions.filter((decision) => notebookMatches(decision, query, instrument, timeframe, state));
  const instruments = [...new Set(decisions.map((decision) => decision.analysis.instrument))].sort();
  const timeframes = [...new Set(decisions.map((decision) => decision.analysis.timeframe).filter(Boolean))].sort();
  async function exportBackup() {
    setBusy(true); setMessage("");
    try {
      const savedRules = await loadRules();
      const blob = new Blob([createNotebookBackup(filtered, savedRules)], { type: "application/json" });
      const file = new File([blob], `pocket-bullseye-notebook-${new Date().toISOString().slice(0,10)}.json`, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Pocket Bullseye notebook backup" });
      else { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
      trackGrowth("backup_exported"); setMessage(`Backup prepared for ${filtered.length} decisions. Keep the file somewhere private.`);
    } catch (error) { setMessage(error instanceof Error && error.name === "AbortError" ? "Backup sharing cancelled." : error instanceof Error ? error.message : "Backup could not be created."); } finally { setBusy(false); }
  }
  async function importFile(file: File) {
    setBusy(true); setMessage(""); setBackup(null);
    try { if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a backup smaller than 64 MB."); setBackup(parseNotebookBackup(await file.text())); }
    catch (error) { setMessage(error instanceof SyntaxError ? "This file is not a valid notebook backup." : error instanceof Error ? error.message : "Backup could not be read."); } finally { setBusy(false); }
  }
  async function restore() {
    if (!backup) return; setBusy(true);
    try { setMessage(await onRestore(backup)); trackGrowth("backup_restored"); const saved = await loadRules(); setRules([saved[0] ?? "",saved[1] ?? "",saved[2] ?? ""]); setPinned(saved); setRulesReady(true); setBackup(null); }
    catch { setMessage("Restore could not finish. Your existing decisions are safe; please retry."); } finally { setBusy(false); }
  }
  return <section id="bullseye-notebook" className="pbResearchPanel pbNotebook">
    <header><div><span>Private · on this device</span><h2>Your setup notebook</h2></div><b>{decisions.length} saved</b></header>
    <p>Find a previous setup. Record what you learned. Carry your own rules forward.</p>
    {pinned.length ? <ol className="pbPinnedRules" aria-label="My pinned personal rules">{pinned.map((rule,index) => <li key={index}>{rule}</li>)}</ol> : null}
    <details className="pbRules"><summary>My three personal rules</summary>{rules.map((rule,index) => <label key={index}>Rule {index+1}<input disabled={!rulesReady} value={rule} maxLength={180} placeholder="A rule I choose to follow" onChange={(event) => setRules(rules.map((value,i) => i === index ? event.target.value : value))} /></label>)}<button type="button" disabled={busy || !rulesReady} onClick={async () => { setBusy(true); try { const saved = rules.map((rule) => rule.trim()).filter(Boolean); await saveRules(saved); setPinned(saved); setMessage("Your personal rules are saved."); } catch { setMessage("Rules could not be saved. Please retry."); } finally { setBusy(false); } }}>Pin my rules</button></details>
    <NotebookInsights decisions={decisions} />
    <div className="pbNotebookFilters"><label>Search setups & lessons<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(10); }} placeholder="Instrument, pattern, tag or lesson" /></label>
      <label>Instrument<select value={instrument} onChange={(event) => setInstrument(event.target.value)}><option value="">All instruments</option>{instruments.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Timeframe<select value={timeframe} onChange={(event) => setTimeframe(event.target.value)}><option value="">All timeframes</option>{timeframes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Review state<select value={state} onChange={(event) => setState(event.target.value)}><option value="">All decisions</option><option value="waiting">Awaiting review</option><option value="reviewed">Reviewed</option><option value="lesson">My lesson recorded</option></select></label>
    </div>
    <div className="pbNotebookEntries">{filtered.slice(0,limit).map((decision) => <article key={decision.id}><div className="pbNotebookEntryTop"><img loading="lazy" src={decision.image} alt={`Saved ${decision.analysis.instrument} chart`} /><div><h3>{decision.analysis.instrument}</h3><span>{decision.analysis.timeframe} · {new Date(decision.createdAt).toLocaleDateString("en-GB")}</span><small>{decision.review ? "Reviewed" : "Awaiting a later chart"}</small></div></div>
      {decision.notebook?.tags.length ? <p className="pbNotebookTags">{decision.notebook.tags.map((tag) => <span key={tag}>{tag}</span>)}</p> : null}
      <button type="button" onClick={() => onReview(decision)}>{decision.review ? "Open visual review" : "Add a later chart"} ↗</button><NoteEditor decision={decision} onSave={onSave}/>
    </article>)}</div>
    {!filtered.length ? <p>{decisions.length ? "No saved setups match these filters." : "Your successful scans will appear here. Add a later chart when you return to review a decision."}</p> : null}
    {filtered.length > limit ? <button type="button" onClick={() => setLimit(limit + 10)}>Show 10 more</button> : null}
    <details className="pbBackup"><summary>Backup & restore</summary><p>Export includes your screenshots, original reads, reviews, personal notes and saved rules. Filters apply to exported decisions. Files are not encrypted; store them privately. Clearing browser storage can remove this notebook.</p>
      <div className="pbSnapshotControls"><button type="button" disabled={busy || !rulesReady} onClick={exportBackup}>Export {filtered.length} decisions</button><button type="button" disabled={busy} onClick={() => picker.current?.click()}>Choose backup</button></div>
      <input ref={picker} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importFile(file); }}/>
      {backup ? <div className="pbRestorePreview"><p>Ready to restore {backup.decisions.length} decisions and up to {backup.rules.length} rules. Existing decisions stay intact; different versions are kept separately. Your existing rules take priority, with three pinned in total.</p><button type="button" disabled={busy} onClick={restore}>Restore into my notebook</button><button type="button" disabled={busy} onClick={() => setBackup(null)}>Cancel</button></div> : null}
    </details><p role="status">{message}</p>
  </section>;
}
