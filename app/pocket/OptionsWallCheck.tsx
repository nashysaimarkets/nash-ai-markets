"use client";

import { useState, type ChangeEvent } from "react";
import type { OptionsWallResult } from "./options-wall";

export default function OptionsWallCheck({ ticker, levels }: { ticker: string; levels: { kind: string; price: string; label: string }[] }) {
  const readyForComparison = ticker !== "UNKNOWN" && Boolean(ticker.trim()) && levels.some((level) => ["support", "resistance", "pivot"].includes(level.kind) && /^\d[\d,.]*$/.test(level.price.trim()));
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OptionsWallResult | null>(null);

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setResult(null); setError(""); setImage("");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Add a JPEG, PNG or WebP screenshot under 8 MB."); return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
      });
      setImage(data); setFileName(file.name);
    } catch { setError("The screenshot could not be opened."); }
  }

  async function check() {
    if (!image || busy || !readyForComparison) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/pocket/options-wall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, ticker, levels: levels.map(({ kind, price, label }) => ({ kind, price, label })) }) });
      const payload = await response.json() as { result?: OptionsWallResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The options check could not complete.");
      setResult(payload.result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The options check could not complete."); }
    finally { setBusy(false); }
  }

  return <section className="psOptionsWall" aria-live="polite" aria-busy={busy}>
    <header><div><span>◉ OPTIONS WALL CROSS-CHECK</span><small>OPTIONAL · SCREENSHOT EVIDENCE</small></div><b>{busy ? "READING…" : result?.status === "MATCHED" ? "OVERLAP FOUND" : result ? "CHECK COMPLETE" : image ? "READY" : "ADD PROFILE"}</b></header>
    <p>Add an options <strong>volume-by-strike</strong> screenshot for the same listed symbol. Bullseye checks whether visible volume concentrations sit near verified price levels.</p>
    {!readyForComparison ? <p className="psOptionsWallNotice">Available when the chart has a confirmed listed ticker and a verified numeric price level.</p> : <div className="psOptionsWallActions"><label>{image ? "CHANGE SCREENSHOT" : "＋ ADD OPTIONS SCREENSHOT"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add options volume profile screenshot" onChange={attach} disabled={busy} /></label><button type="button" onClick={check} disabled={!image || busy}>{busy ? "CHECKING…" : "CHECK OPTIONS WALL"}</button></div>}
    {image ? <small className="psOptionsWallFile">{fileName}</small> : null}
    {error ? <p role="alert" className="psOptionsWallError">{error}</p> : null}
    {result ? <div className="psOptionsWallResult" data-status={result.status}><strong>{result.status === "UNVERIFIED" ? "COMPARISON HELD" : result.status === "MATCHED" ? "VISIBLE OVERLAP" : "NO VERIFIED OVERLAP"}</strong><p>{result.message}</p>{result.matches.length ? <ul>{result.matches.map((match, index) => <li key={`${match.expiry}-${match.side}-${match.strike}-${index}`}><b>{match.side} {match.strike}</b><span>{match.volume.toLocaleString()} traded · {match.expiry} · near {match.level.kind} {match.level.price}</span></li>)}</ul> : null}</div> : null}
    <footer>Volume is activity, not proof of positioning or direction. This check does not change your verdict, score or chart levels.</footer>
  </section>;
}
