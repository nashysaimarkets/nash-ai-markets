"use client";

import { useState, type ChangeEvent } from "react";
import { cryptoPair, type CryptoPressureResult } from "./crypto-pressure";

export default function CryptoPressureCheck({ instrument, levels, chartDirection, canScan }: { instrument: string; levels: { kind: string; price: string }[]; chartDirection: "BULLISH" | "BEARISH" | "NEUTRAL"; canScan: () => Promise<boolean> }) {
  const pair = cryptoPair(instrument);
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CryptoPressureResult | null>(null);

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (!file) return;
    setImage(""); setResult(null); setError("");
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
    if (!image || busy || !pair || !await canScan()) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/pocket/crypto-pressure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, instrument, chartDirection, levels: levels.map(({ kind, price }) => ({ kind, price })) }) });
      const payload = await response.json() as { result?: CryptoPressureResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The derivatives check could not complete.");
      setResult(payload.result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The derivatives check could not complete."); }
    finally { setBusy(false); }
  }

  return <section className="psOptionsWall psCryptoPressure" aria-live="polite" aria-busy={busy}>
    <header><div><span>◈ CRYPTO DERIVATIVES PRESSURE</span><small>OPTIONAL · SAME PAIR ONLY</small></div><b>{busy ? "READING…" : result ? "CHECK COMPLETE" : image ? "READY" : pair || "CRYPTO ONLY"}</b></header>
    <p>Attach a funding, open-interest or liquidation panel for the exact crypto pair shown on your price chart.</p>
    {!pair ? <p className="psOptionsWallNotice">Available when the chart clearly names a crypto pair such as BTC/USD or ETH/USDT.</p> : <div className="psOptionsWallActions"><label>{image ? "CHANGE SCREENSHOT" : "＋ ADD DERIVATIVES PANEL"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add crypto derivatives panel screenshot" onChange={attach} disabled={busy} /></label><button type="button" onClick={check} disabled={!image || busy}>{busy ? "CHECKING…" : "CHECK PRESSURE"}</button></div>}
    {image ? <small className="psOptionsWallFile">{fileName}</small> : null}
    {error ? <p role="alert" className="psOptionsWallError">{error}</p> : null}
    {result ? <div className="psOptionsWallResult" data-status={result.status}><strong>{result.status === "UNVERIFIED" ? "COMPARISON HELD" : result.overlap.length ? "PRICE-LEVEL OVERLAP" : "PANEL CONTEXT"}</strong><p>{result.conflict}</p>{result.observations.length || result.overlap.length ? <ul>{[...result.observations, ...result.overlap].map((item, index) => <li key={index}>{item}</li>)}</ul> : null}<p>{result.caution}</p></div> : null}
    <footer>Panel metrics add context to the existing chart audit. They never alter its verdict, score or levels.</footer>
  </section>;
}
