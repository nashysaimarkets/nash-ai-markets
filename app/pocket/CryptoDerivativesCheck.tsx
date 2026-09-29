"use client";

import { useState, type ChangeEvent } from "react";
import { cryptoBase, type DerivativesResult } from "./crypto-derivatives";

export default function CryptoDerivativesCheck({ ticker, structure }: { ticker: string; structure: string }) {
  const base = cryptoBase(ticker);
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DerivativesResult | null>(null);
  if (!base) return null;

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setResult(null); setError(""); setImage(""); setFileName("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
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
    if (!image || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/pocket/crypto-derivatives", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, ticker, structure }) });
      const payload = await response.json() as { result?: DerivativesResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The panel check could not complete.");
      setResult(payload.result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The panel check could not complete."); }
    finally { setBusy(false); }
  }

  return <section className="psOptionsWall" aria-live="polite" aria-busy={busy}>
    <header><div><span>◇ CRYPTO DERIVATIVES CHECK</span><small>OPTIONAL · {base} · SCREENSHOT EVIDENCE</small></div><b>{busy ? "READING…" : result ? "CHECK COMPLETE" : image ? "READY" : "ADD PANEL"}</b></header>
    <p>Upload a derivatives panel for the same crypto asset. Compare visible funding, open interest, positioning and liquidations with the chart structure.</p>
    <div className="psOptionsWallActions"><label>{image ? "CHANGE SCREENSHOT" : "＋ ADD PANEL SCREENSHOT"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add crypto derivatives panel screenshot" onChange={attach} disabled={busy} /></label><button type="button" onClick={check} disabled={!image || busy}>{busy ? "CHECKING…" : "CHECK DERIVATIVES"}</button></div>
    {image ? <small className="psOptionsWallFile">{fileName}</small> : null}
    {error ? <p role="alert" className="psOptionsWallError">{error}</p> : null}
    {result ? <div className="psOptionsWallResult" data-status={result.status}><strong>{result.status === "UNVERIFIED" ? "COMPARISON HELD" : "VISIBLE CONTEXT"}</strong><p>{result.message}</p>{result.observations.length ? <ul>{result.observations.map((item) => <li key={item}>{item}</li>)}</ul> : null}{result.conflict ? <p>{result.conflict}</p> : null}</div> : null}
    <footer>Venue, units and timing matter. A screenshot cannot verify live positioning or liquidation pressure. This context does not change the verdict, score or chart levels.</footer>
  </section>;
}
